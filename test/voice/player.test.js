var mm = require('@yodaos/mm')
var mock = require('@yodaos/mm/mock')

var test = mm.test
test = mm.beforeEach(test, t => {
  t.suite = mm.bootstrap()
  t.end()
})
test = mm.afterEach(test, t => {
  t.suite.teardown()
  t.end()
})

function focusOnce (t, event, expectedFocus) {
  return new Promise(resolve => {
    t.suite.audioFocus
      .once(event, focus => {
        if (expectedFocus == null) {
          resolve(focus)
        }
        if (focus === expectedFocus) {
          resolve(focus)
        }
      })
  })
}

function speechSynthesisOnce (t, event, expectedUtterance) {
  return new Promise(resolve => {
    t.suite.speechSynthesis
      .once(event, utter => {
        if (expectedUtterance == null) {
          resolve(utter)
        }
        if (utter === expectedUtterance) {
          resolve(utter)
        }
        resolve(utter)
      })
  })
}

test('should resume on gain if no text given', t => {
  t.plan(2)

  var application = t.suite.getApplication()
  var voice = application.startVoice('player', [null, '/opt/media/awake_01.wav'])

  mock.proxyMethod(voice.player, 'start', {
    before: () => {
      t.pass('player started')
    }
  })
  focusOnce(t, 'gained')
    .then(() => {
      t.strictEqual(voice.resumeOnGain, false)
      t.end()
    })
})

test('should handle player error', t => {
  t.plan(1)

  var application = t.suite.getApplication()
  var voice = application.startVoice('player', [null, 'http://foo.onion/media.mp3'])

  focusOnce(t, 'gained', voice)
    .then(() => {
      return focusOnce(t, 'lost', voice)
    })
    .then(() => {
      t.ok(voice.player == null)
      t.end()
    })
    .catch(err => {
      t.error(err)
      t.end()
    })
})

test('should unset player on focus loss to prevent unexpected MediaPlayer not setup error', t => {
  t.plan(1)

  var application = t.suite.getApplication()
  var voice = application.startVoice('player', [null, '/opt/media/awake_01.wav'])

  focusOnce(t, 'gained', voice)
    .then(() => {
      return focusOnce(t, 'lost', voice)
    })
    .then(() => {
      t.ok(voice.player == null)
      t.end()
    })
})

test('should resume on speech-synthesis end if text given and ran sequentially', t => {
  t.plan(1)

  var application = t.suite.getApplication()
  var voice = application.startVoice('player', ['foo', '/opt/media/awake_01.wav', /** transient */true, /** sequential */true])

  mock.proxyMethod(voice.player, 'start', {
    before: () => {
      t.fail('unreachable path')
    }
  })
  focusOnce(t, 'gained')
    .then(() => {
      mock.restore()
      mock.proxyMethod(voice.player, 'start', {
        before: () => {
          t.pass('player started')
        }
      })
      return speechSynthesisOnce(t, 'end')
    })
    .then(() => {
      t.end()
    })
})

test('should not resume if paused before transient focus loss', t => {
  t.plan(3)

  var application = t.suite.getApplication()
  var voice = application.startVoice('player', [null, '/opt/media/awake_01.wav'])
  focusOnce(t, 'gained')
    .then(() => {
      voice.pause()
      t.pass('player paused')

      mock.mockReturns(voice.player, 'start', () => {
        t.fail('unreachable path')
      })
      var cut = application.startVoice('player', ['foo', null, /** transient */true])
      return focusOnce(t, 'gained', cut)
    })
    .then(() => {
      mock.restore()
      mock.proxyMethod(voice.player, 'start', {
        before: () => {
          t.pass('player started')
        }
      })
      voice.resume()
      return focusOnce(t, 'gained', voice)
    })
    .then(() => {
      t.strictEqual(voice.resumeOnGain, false)
      t.end()
    })
})

test('should resume media on focus regained while speech interrupted', t => {
  t.plan(3)

  var application = t.suite.getApplication()
  var voice = application.startVoice('player', ['foo', '/opt/media/awake_01.wav', /** transient */false, /** sequential */true])

  focusOnce(t, 'gained', voice)
    .then(() => {
      var cut = application.startVoice('player', ['foo', /** media */undefined, /** transient */true, /** sequential */true])
      return focusOnce(t, 'gained', cut)
    })
    .then(() => {
      t.strictEqual(voice.resumeOnGain, true, 'be resumable on gained although speech interrupted')
      mock.proxyMethod(voice.player, 'start', {
        before: () => {
          t.pass('player started')
        }
      })
      return focusOnce(t, 'gained', voice)
    })
    .then(() => {
      t.strictEqual(voice.resumeOnGain, false, 'be not resumable on gained after media recovered')
      t.end()
    })
})
