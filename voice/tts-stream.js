var AudioFocus = require('@yodaos/application').AudioFocus
var speechSynthesis = require('@yodaos/speech-synthesis').speechSynthesis
var logger = require('logger')('tts-stream')

var nowPlayingCenter = require('@yodaos/application').NowPlayingCenter.default

var constant = require('../constant')
var GetStreamChannel = constant.GetStreamChannel
var TtsStatusChannel = constant.TtsStatusChannel
var StatusCode = constant.StatusCode

module.exports = function TtsStream (pickupOnEnd, pickupDuration, hint) {
  var focus = new AudioFocus(AudioFocus.Type.TRANSIENT)
  focus.onGain = () => {
    var utter = speechSynthesis.playStream(hint)
      .on('start', () => {
        this.agent.post(TtsStatusChannel, [StatusCode.start])
      })
      .on('cancel', () => {
        logger.info('on cancel')
        this.agent.post(TtsStatusChannel, [StatusCode.cancel])
        focus.abandon()
      })
      .on('error', () => {
        logger.info('on error')
        this.agent.post(TtsStatusChannel, [StatusCode.error])
        focus.abandon()
      })
      .on('end', () => {
        logger.info('on end')
        this.agent.post(TtsStatusChannel, [StatusCode.end])
        if (pickupOnEnd) {
          /** this url would preempt current focus */
          this.openUrl('yoda-app://launcher/pickup')
        } else {
          focus.abandon()
        }
      })

    this.agent.declareMethod(GetStreamChannel, (req, res) => {
      logger.info('on get stream channel', utter.id)
      res.end(0, [utter.id])

      /**
       * Remove method immediately after first successful invocation.
       * Prevent confusing stream name between consecutive stream request.
       */
      this.agent.removeMethod(GetStreamChannel)
    })

    nowPlayingCenter.setNowPlayingInfo({/** nothing to be set */})
    nowPlayingCenter.on('command', focus.onRemoteCommand)
  }
  focus.onLoss = () => {
    speechSynthesis.cancel()
    this.agent.removeMethod(GetStreamChannel)
    this.finishVoice(focus)
    nowPlayingCenter.setNowPlayingInfo(null)
    nowPlayingCenter.removeListener('command', focus.onRemoteCommand)
  }
  focus.onRemoteCommand = (command) => {
    logger.info('on remote command', command)
    focus.abandon()
  }

  focus.request()

  return focus
}
