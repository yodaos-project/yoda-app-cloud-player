var AudioFocus = require('@yodaos/application').AudioFocus
var speechSynthesis = require('@yodaos/speech-synthesis').speechSynthesis
var MediaPlayer = require('@yoda/multimedia').MediaPlayer
var logger = require('logger')('player')

var NowPlayingCenter = require('@yodaos/application').NowPlayingCenter
var nowPlayingCenter = NowPlayingCenter.default

var constant = require('../constant')
var MultimediaStatusChannel = constant.MultimediaStatusChannel
var TtsStatusChannel = constant.TtsStatusChannel
var StatusCode = constant.StatusCode

module.exports = function Player (text, url, transient, sequential, tag) {
  logger.info(`playing text(${text}) & url(${url}), transient(${transient}), sequential(${sequential})`)
  if (text == null && url == null) {
    return
  }
  var focus = new AudioFocus(transient ? AudioFocus.Type.TRANSIENT : AudioFocus.Type.DEFAULT)
  focus.resumeOnGain = true
  if (url) {
    focus.player = new MediaPlayer()
    focus.player.prepare(url)
    focus.player.once('prepared', () => {
      focus.player.prepared = true
    })
    focus.player.on('playing', () => {
      this.agent.post(MultimediaStatusChannel, [focus.player.startedOnce ? StatusCode.resume : StatusCode.start, tag])
      focus.player.startedOnce = true
    })
    focus.player.on('playbackcomplete', () => {
      focus.player.playbackComplete = true
      this.agent.post(MultimediaStatusChannel, [StatusCode.end, tag])
      if (sequential || !speechSynthesis.speaking) {
        focus.abandon()
      }
    })
    focus.player.on('error', (err) => {
      logger.error('unexpected player error', err.stack)
      this.agent.post(MultimediaStatusChannel, [StatusCode.error, tag])
      focus.player.stop()
      focus.player = null
      if (sequential || !speechSynthesis.speaking) {
        focus.abandon()
      }
    })
  }
  focus.onGain = () => {
    logger.info(`focus gain, transient? ${transient}, player? ${focus.player == null}, resumeOnGain? ${focus.resumeOnGain}`)
    if (text && focus.utter == null) {
      /** on first gain */
      focus.utter = speechSynthesis.speak(text)
        .on('start', () => {
          this.agent.post(TtsStatusChannel, [StatusCode.start])
          if (!sequential && focus.player != null) {
            focus.player.start()
          }
        })
        .on('cancel', () => {
          logger.info('on cancel')
          this.agent.post(TtsStatusChannel, [StatusCode.cancel])
        })
        .on('error', () => {
          logger.info('on error')
          this.agent.post(TtsStatusChannel, [StatusCode.error])
          focus.abandon()
        })
        .on('end', () => {
          logger.info('on end')
          this.agent.post(TtsStatusChannel, [StatusCode.end])

          focus.resumeOnGain = false
          if (sequential && focus.player) {
            focus.player.start()
            return
          }
          if (focus.player && focus.player.playing) {
            return
          }
          focus.abandon()
        })
    } else if (focus.resumeOnGain && focus.player != null) {
      focus.resumeOnGain = false
      focus.player.start()
      if (focus.player.prepared) {
        this.agent.post(MultimediaStatusChannel, [focus.player.startedOnce ? StatusCode.resume : StatusCode.start, tag])
        focus.player.startedOnce = true
      }
    }

    nowPlayingCenter.setNowPlayingInfo({/** nothing to be set */})
    nowPlayingCenter.on('command', focus.onRemoteCommand)
  }
  focus.onLoss = (transient) => {
    logger.info(`focus lost, transient? ${transient}, player? ${focus.player == null}`)
    nowPlayingCenter.setNowPlayingInfo(null)
    nowPlayingCenter.removeListener('command', focus.onRemoteCommand)
    if (focus.utter) {
      speechSynthesis.cancel()
    }
    if (!transient || focus.player == null) {
      if (focus.player && !focus.player.playbackComplete) {
        this.agent.post(MultimediaStatusChannel, [StatusCode.cancel, tag])
      }
      focus.player && focus.player.stop()
      focus.player = null
      this.finishVoice(focus)
      return
    }
    if (!focus.player.playing) {
      return
    }
    focus.resumeOnGain = true
    if (focus.player.playing) {
      this.agent.post(MultimediaStatusChannel, [StatusCode.pause, tag])
    }
    focus.player.pause()
  }
  focus.pause = () => {
    logger.info(`pausing, transient? ${transient}, player? ${focus.player == null}, state? ${focus.state}`)
    if (transient) {
      focus.abandon()
      return
    }
    focus.resumeOnGain = false
    speechSynthesis.cancel()
    if (focus.player) {
      if (focus.player.playing) {
        this.agent.post(MultimediaStatusChannel, [StatusCode.pause, tag])
      }
      focus.player.pause()
    } else {
      focus.abandon()
    }
  }
  focus.resume = () => {
    logger.info(`resuming, transient? ${transient}, player? ${focus.player == null}, state? ${focus.state}`)
    if (transient) {
      return
    }
    if (focus.player == null) {
      return
    }
    if (focus.state === AudioFocus.State.ACTIVE) {
      if (!focus.player.playing && focus.player.prepared) {
        this.agent.post(MultimediaStatusChannel, [focus.player.startedOnce ? StatusCode.resume : StatusCode.start, tag])
        focus.player.startedOnce = true
      }
      focus.player.start()
      return
    }
    focus.resumeOnGain = true
    focus.request()
  }
  focus.seekTo = (pos, immediateResume) => {
    logger.info(`seeking, player? ${focus.player == null}, to ${pos}`)
    if (focus.player == null) {
      return
    }
    focus.player.once('seekcomplete', () => {
      logger.info('seek completed, resuming player immediately?', immediateResume)
      if (immediateResume) {
        focus.resume()
      } else {
        focus.resumeOnGain = true
      }
    })
    focus.player.seekTo(pos)
    logger.info('seeking player, waiting complete event')
  }
  focus.seekBy = (delta, immediateResume) => {
    logger.info(`seeking, player? ${focus.player == null}, by delta ${delta}`)
    if (focus.player == null) {
      return
    }
    var pos = focus.player.position
    if (pos < 0) {
      return
    }
    pos = pos + delta
    if (pos < 0) {
      pos = 0
    }
    focus.seekTo(pos, immediateResume)
  }
  focus.setSpeed = (speed, immediateResume) => {
    logger.info(`resuming, player? ${focus.player == null}, speed ${speed}`)
    if (focus.player == null) {
      return
    }
    focus.player.setSpeed(speed)
    if (immediateResume === true) {
      focus.resume()
    } else {
      /**
       * FIXME: rplayer would resume player right after seek
       */
      focus.pause()
      focus.resumeOnGain = true
    }
  }
  focus.onRemoteCommand = (command) => {
    logger.info(`on remote command ${command.type}, url: ${url}, transient: ${transient}`)
    if (focus.player == null) {
      focus.abandon()
      return
    }
    switch (command.type) {
      case NowPlayingCenter.CommandType.TOGGLE_PAUSE_PLAY: {
        if (transient) {
          focus.abandon()
          return
        }
        if (focus.player.playing) {
          focus.pause()
        } else {
          focus.resume()
        }
      }
    }
  }

  focus.request()
  return focus
}
