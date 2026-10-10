(function () {
  'use strict'

  var grid = document.getElementById('grid')
  var status = document.getElementById('status')

  var player = document.getElementById('player')
  var stage = document.getElementById('stage')
  var video = document.getElementById('video')
  var loader = document.getElementById('loader')
  var unmuteBtn = document.getElementById('unmute')
  var controls = document.getElementById('controls')
  var backBtn = document.getElementById('backBtn')
  var barTitle = document.getElementById('barTitle')
  var barLogo = document.getElementById('barLogo')
  var epgBtn = document.getElementById('epgBtn')
  var playBtn = document.getElementById('playBtn')
  var playIcon = document.getElementById('playIcon')
  var playLabel = document.getElementById('playLabel')
  var epgPopup = document.getElementById('epgPopup')
  var epgClose = document.getElementById('epgClose')
  var epgList = document.getElementById('epgList')
  var fallback = document.getElementById('fallback')
  var errorMsg = document.getElementById('errorMsg')
  var fallbackLogo = document.getElementById('fallbackLogo')
  var fallbackName = document.getElementById('fallbackName')
  var retryBtn = document.getElementById('retryBtn')
  var fallbackBack = document.getElementById('fallbackBack')

  var channels = []
  var epg = {}
  var channel = null
  var hls = null
  var tierBlobUrl = null
  var controlsTimer = null
  var networkRetries = 0
  var pushed = false
  var loading = false

  var FALLBACK_MSG = {
    timeout: 'ช่องสัญญาณไม่ตอบสนองชั่วคราว สตรีมตอบช้าเกินกำหนด กด "ลองใหม่" เพื่อเชื่อมต่ออีกครั้ง',
    cors: 'เล่นช่องนี้ในเบราว์เซอร์ไม่ได้ เพราะสตรีมต้นทางไม่ให้สิทธิ์',
    media: 'เล่นช่องนี้ในเบราว์เซอร์ไม่ได้ (สตรีมติด CORS หรือลิงก์หมดอายุ)',
    http: 'ช่องนี้ใช้สตรีม HTTP จึงเล่นบนหน้า HTTPS ไม่ได้ ลองเปิดในเบราว์เซอร์อื่นแทน',
    unsupported: 'เบราว์เซอร์นี้ไม่รองรับการเล่น HLS',
    script: 'โหลดตัวเล่นไม่สำเร็จ ลองรีเฟรชอีกครั้ง',
    stream: 'เล่นช่องนี้ในเบราว์เซอร์ไม่ได้ สตรีมอาจติด CORS'
  }

  function param(name) {
    return new URLSearchParams(window.location.search).get(name)
  }

  function isIOS() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    )
  }

  function findChannel(tvgId) {
    for (var i = 0; i < channels.length; i++) {
      if (channels[i].tvgId === tvgId) return channels[i]
    }
    return null
  }

  function decodeEntities(value) {
    if (!value) return ''
    var doc = new DOMParser().parseFromString('<body>' + value + '</body>', 'text/html')
    return doc.body.textContent || ''
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /* ---------- Fullscreen helpers ---------- */

  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null
  }

  function requestFullscreen(el) {
    var fn = el.requestFullscreen || el.webkitRequestFullscreen
    if (!fn) return
    try {
      var result = fn.call(el)
      if (result && result.catch) result.catch(function () {})
    } catch {
      /* element fullscreen unsupported: CSS overlay still fills the screen */
    }
  }

  function exitFullscreen() {
    var fn = document.exitFullscreen || document.webkitExitFullscreen
    if (!fn) return
    try {
      var result = fn.call(document)
      if (result && result.catch) result.catch(function () {})
    } catch {
      /* ignore */
    }
  }

  /* ---------- Controls overlay ---------- */

  function syncPlayIcon() {
    playIcon.className = video.paused ? 'icon-play' : 'icon-pause'
    playLabel.textContent = video.paused ? 'Play' : 'Pause'
  }

  function hideControls() {
    if (!epgPopup.hidden) return
    controls.hidden = true
    if (loader) loader.classList.add('is-center')
    clearTimeout(controlsTimer)
    controlsTimer = null
  }

  function restartControlsTimer() {
    clearTimeout(controlsTimer)
    controlsTimer = null
    if (loading || video.paused || !fallback.hidden) return
    controlsTimer = setTimeout(hideControls, 4000)
  }

  function showControls() {
    if (!fallback.hidden) return
    controls.hidden = false
    if (loader) loader.classList.remove('is-center')
    restartControlsTimer()
  }

  function toggleControls() {
    if (controls.hidden) {
      showControls()
    } else {
      hideControls()
    }
  }

  /* ---------- Playback ---------- */

  function showLoader() {
    if (loader) loader.hidden = false
  }

  function hideLoader() {
    if (loader) loader.hidden = true
  }

  function warmUpHost(url) {
    try {
      var origin = new URL(url, window.location.href).origin
      if (!origin || origin === window.location.origin) return
      var link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = origin
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    } catch {
      /* ignore malformed stream url */
    }
  }

  function showFallback(message) {
    loading = false
    hideLoader()
    hideControls()
    if (channel && channel.name) {
      fallbackName.textContent = displayName(channel)
      if (channel.logo) {
        fallbackLogo.src = channel.logo
        fallbackLogo.hidden = false
      } else {
        fallbackLogo.hidden = true
        fallbackLogo.removeAttribute('src')
      }
    } else {
      fallbackName.textContent = ''
      fallbackLogo.hidden = true
      fallbackLogo.removeAttribute('src')
    }
    errorMsg.textContent = message
    fallback.hidden = false
  }

  function tryPlay() {
    video.muted = false
    var attempt = video.play()
    if (attempt && attempt.catch) {
      attempt.catch(function (err) {
        if (!err || err.name === 'NotAllowedError') unmuteBtn.hidden = false
      })
    }
  }

  function loadHlsScript() {
    return new Promise(function (resolve, reject) {
      if (window.Hls) return resolve()

      var script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
      script.async = true
      script.dataset.hls = 'true'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  /* ---------- Multi-tier ABR for thaimomo ---------- */

  var TIER_RE = /^(https:\/\/live-us1\.thaimomo\.com\/live-as\/[A-Za-z0-9]+)-\d+(\/playlist\.m3u8)$/

  var FETCH_TIMEOUT = 5000

  function fetchText(url) {
    var controller = new AbortController()
    var timer = setTimeout(function () {
      controller.abort()
    }, FETCH_TIMEOUT)
    return fetch(url, { mode: 'cors', cache: 'no-store', signal: controller.signal })
      .then(function (response) {
        clearTimeout(timer)
        return response.ok ? response.text() : null
      })
      .catch(function () {
        clearTimeout(timer)
        return null
      })
  }

  function buildTierMaster(url) {
    var match = url.match(TIER_RE)
    if (!match) return Promise.resolve(null)

    var base = match[1]
    var suffix = match[2]
    var tiers = [1, 2, 3]

    return Promise.all(
      tiers.map(function (tier) {
        return fetchText(base + '-' + tier + suffix).then(function (text) {
          if (!text) return null
          var lines = text.split(/\r?\n/)
          var inf = null
          var file = null
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim()
            if (!line) continue
            if (line.indexOf('#EXT-X-STREAM-INF') === 0) inf = line
            else if (line.charAt(0) !== '#') file = line
          }
          if (!inf || !file) return null
          return { inf: inf, uri: base + '-' + tier + '/' + file }
        })
      })
    ).then(function (variants) {
      var valid = variants.filter(Boolean)
      if (valid.length < 2) return null

      var out = '#EXTM3U\n#EXT-X-VERSION:3\n'
      for (var i = 0; i < valid.length; i++) {
        out += valid[i].inf + '\n' + valid[i].uri + '\n'
      }
      return out
    })
  }

  function attachHls(url) {
    networkRetries = 0
    hls = new window.Hls({
      lowLatencyMode: false,
      startLevel: 0,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      backBufferLength: 90,
      testBandwidth: false,
      abrEwmaDefaultEstimate: 2000000,
      abrEwmaFastLive: 2,
      abrEwmaSlowLive: 9,
      abrBandWidthFactor: 0.9,
      abrBandWidthUpFactor: 0.7,
      abrMaxWithRealBitrate: true,
      enableWorker: true,
      progressive: true,
      startFragPrefetch: true,
      initialLiveManifestSize: 1,
      liveSyncDurationCount: 1,
      manifestLoadingMaxRetry: 2,
      manifestLoadingRetryDelay: 500,
      manifestLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 3,
      levelLoadingTimeOut: 10000,
      fragLoadingMaxRetry: 3,
      fragLoadingTimeOut: 30000
    })
    hls.attachMedia(video)
    hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
      if (video.paused) tryPlay()
    })
    hls.loadSource(url)
    hls.on(window.Hls.Events.ERROR, function (event, data) {
      if (!data || !data.fatal) return
      switch (data.type) {
        case window.Hls.ErrorTypes.NETWORK_ERROR: {
          var isTimeout = !!data.details && data.details.indexOf('TimeOut') !== -1
          if (networkRetries < 3) {
            networkRetries++
            var retryDelay = 500 * Math.pow(2, networkRetries - 1)
            setTimeout(function () {
              if (hls) hls.startLoad()
            }, retryDelay)
          } else {
            hls.destroy()
            hls = null
            showFallback(isTimeout ? FALLBACK_MSG.timeout : FALLBACK_MSG.cors)
          }
          break
        }
        case window.Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError()
          break
        default:
          hls.destroy()
          hls = null
          showFallback(FALLBACK_MSG.media)
      }
    })
  }

  function resetPlayback() {
    loading = false
    hideLoader()
    if (tierBlobUrl) {
      URL.revokeObjectURL(tierBlobUrl)
      tierBlobUrl = null
    }
    if (hls) {
      hls.destroy()
      hls = null
    }
    video.pause()
    video.removeAttribute('src')
    try {
      video.load()
    } catch {
      /* ignore */
    }
  }

  function retryPlayback() {
    if (!channel) return
    resetPlayback()
    fallback.hidden = true
    errorMsg.textContent = ''
    showControls()
    startPlayback(channel.url)
  }

  function startPlayback(url) {
    if (window.location.protocol === 'https:' && url.indexOf('http://') === 0) {
      showFallback(FALLBACK_MSG.http)
      return
    }

    showLoader()
    warmUpHost(url)
    loading = true
    showControls()

    var playNative = function () {
      video.src = url
      tryPlay()
    }

    var playWithHls = function () {
      buildTierMaster(url).then(function (master) {
        if (!channel) return
        if (master) {
          tierBlobUrl = URL.createObjectURL(
            new Blob([master], { type: 'application/vnd.apple.mpegurl' })
          )
          attachHls(tierBlobUrl)
        } else {
          attachHls(url)
        }
      })
    }

    if (isIOS() && video.canPlayType('application/vnd.apple.mpegurl')) {
      playNative()
      return
    }

    if (window.Hls && window.Hls.isSupported()) {
      playWithHls()
      return
    }

    loadHlsScript()
      .then(function () {
        if (window.Hls && window.Hls.isSupported()) {
          playWithHls()
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          playNative()
        } else {
          showFallback(FALLBACK_MSG.unsupported)
        }
      })
      .catch(function () {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          playNative()
        } else {
          showFallback(FALLBACK_MSG.script)
        }
      })
  }

  /* ---------- EPG popup ---------- */

  function buildEpgRow(programme, isNow) {
    var row = document.createElement('div')
    row.className = 'epg-item' + (isNow ? ' is-now' : '')

    var time = document.createElement('span')
    time.className = 'epg-item-time'
    time.textContent = formatTime(programme.start) + ' - ' + formatTime(programme.stop)

    var body = document.createElement('div')
    body.className = 'epg-item-body'

    var title = document.createElement('strong')
    title.textContent = decodeEntities(programme.title) || 'ไม่ทราบชื่อรายการ'
    body.appendChild(title)

    if (programme.desc) {
      var desc = document.createElement('p')
      desc.className = 'muted small'
      desc.textContent = decodeEntities(programme.desc)
      body.appendChild(desc)
    }

    row.appendChild(time)
    row.appendChild(body)

    if (isNow) {
      var badge = document.createElement('span')
      badge.className = 'epg-item-badge'
      badge.textContent = 'กำลังออกอากาศ'
      row.appendChild(badge)
    }

    return row
  }

  function renderEpgList() {
    epgList.innerHTML = ''
    if (!channel) return

    var list = epg[channel.tvgId] || []
    if (!list.length) {
      var empty = document.createElement('p')
      empty.className = 'muted epg-popup-empty'
      empty.textContent = 'ไม่มีข้อมูลผังรายการสำหรับช่องนี้'
      epgList.appendChild(empty)
      return
    }

    var now = Date.now()
    var fragment = document.createDocumentFragment()
    for (var i = 0; i < list.length; i++) {
      fragment.appendChild(buildEpgRow(list[i], list[i].start <= now && now < list[i].stop))
    }
    epgList.appendChild(fragment)

    var nowRow = epgList.querySelector('.is-now')
    if (nowRow && nowRow.scrollIntoView) {
      nowRow.scrollIntoView({ block: 'center' })
    }
  }

  function openEpgPopup() {
    epgPopup.hidden = false
    renderEpgList()
    controls.hidden = false
    clearTimeout(controlsTimer)
    controlsTimer = null
  }

  function closeEpgPopup() {
    epgPopup.hidden = true
    showControls()
  }

  /* ---------- Player lifecycle ---------- */

  function openPlayer(target, withFullscreen) {
    channel = target
    document.title = channel.name + ' - HK IPTV'
    barTitle.textContent = displayName(channel)

    if (channel.logo) {
      barLogo.src = channel.logo
      barLogo.hidden = false
    } else {
      barLogo.hidden = true
      barLogo.removeAttribute('src')
    }

    fallback.hidden = true
    errorMsg.textContent = ''
    epgPopup.hidden = true
    unmuteBtn.hidden = true

    player.hidden = false
    showControls()
    showLoader()
    syncPlayIcon()

    if (withFullscreen) requestFullscreen(stage)

    startPlayback(channel.url)
    renderEpgList()
  }

  function closePlayer() {
    if (!channel) return

    resetPlayback()
    clearTimeout(controlsTimer)
    controlsTimer = null

    channel = null
    epgPopup.hidden = true
    controls.hidden = true
    unmuteBtn.hidden = true
    fallback.hidden = true
    player.hidden = true
    document.title = 'ดูทีวีออนไลน์ - HK IPTV'

    if (fsElement()) exitFullscreen()
  }

  function goBack() {
    if (pushed) {
      history.back()
    } else {
      history.replaceState({}, '', 'index.html')
      closePlayer()
    }
  }

  /* ---------- List page ---------- */

  function initials(name) {
    return (name || '?').trim().charAt(0).toUpperCase()
  }

  function displayName(item) {
    return item.number ? 'ช่อง ' + item.number + ' | ' + item.name : item.name
  }

  function createCard(item) {
    var link = document.createElement('a')
    link.className = 'card'
    link.href = '?tvgId=' + encodeURIComponent(item.tvgId)
    link.dataset.tvgId = item.tvgId

    var thumb = document.createElement('div')
    thumb.className = 'thumb'

    if (item.logo) {
      var img = document.createElement('img')
      img.loading = 'lazy'
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.alt = item.name
      img.src = item.logo
      img.addEventListener('error', function () {
        img.remove()
        thumb.classList.add('thumb-fallback')
        thumb.textContent = initials(item.name)
      })
      thumb.appendChild(img)
    } else {
      thumb.classList.add('thumb-fallback')
      thumb.textContent = initials(item.name)
    }

    var title = document.createElement('span')
    title.className = 'card-title'
    title.textContent = displayName(item)

    link.appendChild(thumb)
    link.appendChild(title)

    link.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (event.button && event.button !== 0) return

      var target = findChannel(item.tvgId)
      if (!target) return

      event.preventDefault()
      history.pushState({ tvgId: item.tvgId }, '', '?tvgId=' + encodeURIComponent(item.tvgId))
      pushed = true
      openPlayer(target, true)
    })

    return link
  }

  function loadChannels() {
    return fetch('channels.json')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
      })
      .then(function (data) {
        channels = Array.isArray(data) ? data : []
      })
  }

  function loadEpg() {
    fetch('epg.json')
      .then(function (response) {
        return response.ok ? response.json() : {}
      })
      .catch(function () {
        return {}
      })
      .then(function (data) {
        epg = data || {}
        if (channel) renderEpgList()
      })
  }

  function renderGrid() {
    if (!channels.length) {
      status.textContent = 'ยังไม่มีช่องในขณะนี้'
      return
    }

    var fragment = document.createDocumentFragment()
    channels.forEach(function (item) {
      fragment.appendChild(createCard(item))
    })
    grid.appendChild(fragment)
    grid.hidden = false
    status.hidden = true
  }

  /* ---------- Events ---------- */

  stage.addEventListener('click', function (event) {
    if (event.target.closest('.controls')) return
    if (event.target.closest('.epg-popup')) return
    if (event.target.closest('.fallback')) return
    if (event.target.closest('.unmute')) return
    toggleControls()
  })

  backBtn.addEventListener('click', function (event) {
    event.stopPropagation()
    goBack()
  })

  epgBtn.addEventListener('click', function (event) {
    event.stopPropagation()
    if (epgPopup.hidden) openEpgPopup()
    else closeEpgPopup()
  })

  epgClose.addEventListener('click', function (event) {
    event.stopPropagation()
    closeEpgPopup()
  })

  epgPopup.addEventListener('click', function (event) {
    if (event.target === epgPopup) closeEpgPopup()
  })

  playBtn.addEventListener('click', function (event) {
    event.stopPropagation()
    if (video.paused) {
      video.play()
    } else {
      video.pause()
      loading = false
      hideLoader()
      showControls()
    }
    syncPlayIcon()
    restartControlsTimer()
  })

  barLogo.addEventListener('error', function () {
    barLogo.hidden = true
  })

  fallbackLogo.addEventListener('error', function () {
    fallbackLogo.hidden = true
  })

  unmuteBtn.addEventListener('click', function (event) {
    event.stopPropagation()
    unmuteBtn.hidden = true
    tryPlay()
  })

  video.addEventListener('play', syncPlayIcon)
  video.addEventListener('pause', syncPlayIcon)
  video.addEventListener('playing', function () {
    var wasLoading = loading
    loading = false
    hideLoader()
    syncPlayIcon()
    if (wasLoading) {
      hideControls()
    } else {
      restartControlsTimer()
    }
  })
  video.addEventListener('canplay', hideLoader)
  video.addEventListener('timeupdate', function () {
    if (!video.paused && video.readyState >= 3) hideLoader()
  })
  video.addEventListener('waiting', function () {
    if (channel && fallback.hidden && !video.paused && video.readyState < 3) showLoader()
  })
  video.addEventListener('stalled', function () {
    if (channel && fallback.hidden && !video.paused && video.readyState < 3) showLoader()
  })
  video.addEventListener('error', function () {
    hideLoader()
    if (!video.getAttribute('src')) return
    showFallback(FALLBACK_MSG.stream)
  })

  retryBtn.addEventListener('click', function (event) {
    event.stopPropagation()
    retryPlayback()
  })

  fallbackBack.addEventListener('click', function (event) {
    event.stopPropagation()
    goBack()
  })

  function onFullscreenChange() {
    if (!fsElement() && channel) goBack()
  }

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)

  window.addEventListener('popstate', function () {
    pushed = false
    closePlayer()
  })

  window.addEventListener('beforeunload', function () {
    if (hls) hls.destroy()
    clearTimeout(controlsTimer)
  })

  /* ---------- Init ---------- */

  loadEpg()

  loadChannels()
    .then(function () {
      renderGrid()

      var tvgId = param('tvgId')
      if (!tvgId) return

      var target = findChannel(tvgId)
      if (!target) return
      history.replaceState({ tvgId: tvgId }, '', '?tvgId=' + encodeURIComponent(tvgId))
      pushed = false
      openPlayer(target, false)
    })
    .catch(function () {
      status.textContent = 'โหลดรายการช่องไม่สำเร็จ ลองรีเฟรชอีกครั้ง'
    })
})()
