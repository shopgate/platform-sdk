const chai = require('chai')
const assert = require('assert')

chai.should()
chai.use(require('chai-things'))

const DcRequester = require('../../../../../lib/app/backend/extensionRuntime/context/DcRequester')

describe('DcRequester', () => {
  describe('Instantiation', () => {
    beforeEach(() => {
      DcRequester.instance = undefined
    })

    describe('getInstance', () => {
      it('should create an instance if there is none so far', () => {
        assert.equal(DcRequester.instance, undefined)

        const subjectUnderTest = DcRequester.getInstance()
        subjectUnderTest.should.be.instanceOf(DcRequester)

        assert.ok(DcRequester.instance instanceof DcRequester)
      })

      it('should return an existing instance if there is one', () => {
        const expectedMockObject = { mock: 'test' }

        DcRequester.instance = expectedMockObject

        const subjectUnderTest = DcRequester.getInstance()
        subjectUnderTest.should.equal(expectedMockObject)
      })
    })
  })

  describe('Methods', () => {
    let expectedUuid = 'would normally be a random uuid, but not today'
    let uuidMock = () => { return expectedUuid }
    let subjectUnderTest

    beforeEach(() => {
      subjectUnderTest = new DcRequester(uuidMock)
      DcRequester.instance = subjectUnderTest
      process.send = () => {}
    })

    describe('request', () => {
      const expectedAppId = 'shop_1337'
      const expectedDeviceId = 'device_1773'

      it('should request any resource called for', done => {
        const expectedResourceName = 'some resource'

        process.send = data => {
          data.type.should.equal('dcRequest')
          data.dcRequest.should.include({
            resourceName: expectedResourceName,
            appId: expectedAppId,
            deviceId: expectedDeviceId
          })
          data.dcRequest.should.have.property('requestId').that.is.a('string')
          done()
        }

        subjectUnderTest.request(expectedResourceName, expectedAppId, expectedDeviceId, () => {})
      })

      it('should request appinfos when calling requestAppInfo()', done => {
        const expectedResourceName = 'appinfos'

        process.send = data => {
          data.type.should.equal('dcRequest')
          data.dcRequest.should.include({
            resourceName: expectedResourceName,
            appId: expectedAppId,
            deviceId: expectedDeviceId
          })
          data.dcRequest.should.have.property('requestId').that.is.a('string')
          done()
        }

        subjectUnderTest.requestAppInfo(expectedAppId, expectedDeviceId, () => {})
      })

      it('should request deviceinfos when calling requestDeviceInfo()', done => {
        const expectedResourceName = 'deviceinfos'

        process.send = data => {
          data.type.should.equal('dcRequest')
          data.dcRequest.should.include({
            resourceName: expectedResourceName,
            appId: expectedAppId,
            deviceId: expectedDeviceId
          })
          data.dcRequest.should.have.property('requestId').that.is.a('string')
          done()
        }

        subjectUnderTest.requestDeviceInfo(expectedAppId, expectedDeviceId, () => {})
      })

      it('should save the callback with the request ID from a uuid generator', () => {
        const expectedCallback = 'should be a function, but it is easier to compare just a value for this test'

        subjectUnderTest.request('some resource', expectedAppId, expectedDeviceId, expectedCallback)
        subjectUnderTest._requests.should.include.something.that.deep.equals({
          requestId: expectedUuid,
          cb: expectedCallback
        })
      })

      it('should should pass the request ID from a uuid generator to the main process', done => {
        const expectedCallback = 'should be a function, but it is easier to compare just a value for this test'

        process.send = data => {
          data.dcRequest.should.have.property('requestId').that.equals(expectedUuid)
          done()
        }

        subjectUnderTest.request('some resource', expectedAppId, expectedDeviceId, expectedCallback)
      })

      it('should request userAuth when calling requestUserAuth()', done => {
        process.send = data => {
          data.type.should.equal('dcRequest')
          data.dcRequest.should.include({
            resourceName: 'userAuth',
            appId: expectedAppId,
            pipelineRequestId: 'pipelineRequest1',
            userId: 'user-1'
          })
          data.dcRequest.should.have.property('requestId').that.is.a('string')
          done()
        }

        subjectUnderTest.requestUserAuth(expectedAppId, 'pipelineRequest1', 'user-1').catch(() => {})
      })

      it('should resolve the promise from requestUserAuth() when the dcResponse arrives', async () => {
        process.send = data => {
          DcRequester.handleResponse({ type: 'dcResponse', requestId: data.dcRequest.requestId, info: { success: true } })
        }

        const result = await subjectUnderTest.requestUserAuth(expectedAppId, 'pipelineRequest1', null)
        result.should.deep.equal({ success: true })
      })

      it('should reject the promise from requestUserAuth() when the dcResponse contains an error', async () => {
        process.send = data => {
          DcRequester.handleResponse({ type: 'dcResponse', requestId: data.dcRequest.requestId, error: { message: 'nope', code: 'EFORBIDDEN' } })
        }

        await assert.rejects(
          subjectUnderTest.requestUserAuth(expectedAppId, 'pipelineRequest1', 'user-1'),
          { message: 'nope', code: 'EFORBIDDEN' }
        )
      })
    })

    describe('pull', () => {
      it('should find the proper callback by request ID', done => {
        const expectedMessage = 'test message'
        const expectedCallback = (err, msg) => {
          assert.ifError(err)
          msg.should.equal(expectedMessage)
          done()
        }

        subjectUnderTest._requests.push({ requestId: expectedUuid, cb: expectedCallback })
        subjectUnderTest.pull(expectedUuid)(null, expectedMessage)
      })

      it('should remove the pulled entry so it cannot leak', () => {
        subjectUnderTest._requests.push({ requestId: expectedUuid, cb: () => {} })
        subjectUnderTest.pull(expectedUuid)
        subjectUnderTest._requests.should.have.length(0);
        (() => {
          subjectUnderTest.pull(expectedUuid)
        }).should.throw(Error)
      })

      it('should throw an error if no callback could be found for a given request ID', () => {
        (() => {
          subjectUnderTest.pull(expectedUuid)
        }).should.throw(Error, null, 'Unable to find a callback for DC request ID ' + expectedUuid)
      })
    })

    describe('handleResponse', () => {
      it('should not do anything if message.type is not "dcResponse"', () => {
        subjectUnderTest.pull = () => {
          return () => {
            assert.fail('DcRequester.getInstance() was not expected to be called.')
          }
        }

        DcRequester.handleResponse({ type: 'not a dcResponse', requestId: '', info: '' })
      })

      it('should call the callback with the result of the request', done => {
        const expectedMessage = 'test message'
        const expectedCallback = (err, msg) => {
          assert.ifError(err)
          msg.should.equal(expectedMessage)
          done()
        }
        subjectUnderTest._requests.push({ requestId: expectedUuid, cb: expectedCallback })

        DcRequester.handleResponse({ type: 'dcResponse', requestId: expectedUuid, info: expectedMessage })
      })

      it('should call the callback with an error when the response carries one', done => {
        const expectedCallback = (err) => {
          err.should.be.instanceOf(Error)
          err.message.should.equal('boom')
          err.code.should.equal('EBOOM')
          done()
        }
        subjectUnderTest._requests.push({ requestId: expectedUuid, cb: expectedCallback })

        DcRequester.handleResponse({ type: 'dcResponse', requestId: expectedUuid, error: { message: 'boom', code: 'EBOOM' } })
      })

      it('should throw an error if callback not found', () => {
        const expectedPayload = { type: 'dcResponse', requestId: expectedUuid, info: '123' };

        (() => {
          DcRequester.handleResponse(expectedPayload)
        }).should.throw(Error, 'No callback found for incoming dcResponse: ' + JSON.stringify(expectedPayload))
      })
    })
  })
})
