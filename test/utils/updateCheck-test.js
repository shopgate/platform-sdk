const assert = require('assert')
const proxyquire = require('proxyquire').noPreserveCache()
const sinon = require('sinon')

const pkg = { name: '@shopgate/platform-sdk', version: '3.0.1' }

describe('updateCheck', () => {
  let notifier
  let updateNotifier
  let notifyAboutUpdate

  beforeEach(() => {
    notifier = { notify: sinon.spy() }
    updateNotifier = sinon.stub().returns(notifier)
    notifyAboutUpdate = proxyquire('../../lib/utils/updateCheck', { 'update-notifier': updateNotifier })
  })

  it('should check for updates of the given package on every run', () => {
    notifyAboutUpdate(pkg)

    sinon.assert.calledOnce(updateNotifier)
    assert.strictEqual(updateNotifier.firstCall.args[0].pkg, pkg)
    assert.strictEqual(updateNotifier.firstCall.args[0].updateCheckInterval, 0)
  })

  it('should notify right away when a newer version is available', () => {
    notifier.update = { latest: '3.1.0', current: '3.0.0' }

    notifyAboutUpdate(pkg)

    sinon.assert.calledOnce(notifier.notify)
    sinon.assert.calledWith(notifier.notify, { isGlobal: true, defer: false })
  })

  it('should show the installed version instead of the one from the last check', () => {
    notifier.update = { latest: '3.1.0', current: '3.0.0' }

    notifyAboutUpdate(pkg)

    assert.strictEqual(notifier.update.current, '3.0.1')
  })

  it('should not notify when no update is known', () => {
    notifyAboutUpdate(pkg)

    sinon.assert.notCalled(notifier.notify)
  })

  it('should not notify when the installed version is the latest one', () => {
    notifier.update = { latest: '3.0.1', current: '3.0.0' }

    notifyAboutUpdate(pkg)

    sinon.assert.notCalled(notifier.notify)
  })

  it('should not notify when the installed version is newer than the latest one', () => {
    notifier.update = { latest: '3.0.0', current: '3.0.0' }

    notifyAboutUpdate(Object.assign({}, pkg, { version: '3.1.0-beta.1' }))

    sinon.assert.notCalled(notifier.notify)
  })
})
