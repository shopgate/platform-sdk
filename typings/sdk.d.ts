declare namespace Shopgate.PlatformSdk {
    interface Context {
        meta: Meta
        config: any
        storage: ContextStorage
        settings: ExtensionSettings
        app: AppContext
        device: DeviceContext
        log: Logger
        encrypt: ContextEncrypt
        user: UserContext
    }

    interface UserContext {
        /** Logs the given user in on the current pipeline request. Trusted pipelines only. */
        login(userId: string): Promise<void>
        /** Logs the current user out on the current pipeline request. */
        logout(): Promise<void>
    }

    interface ContextEncrypt {
        /** Encrypts the buffer with the named RSA public key. */
        (keyName: string, buffer: Buffer): Promise<Buffer>
    }

    interface AppContext {
        getInfo: AppInfo | Object
    }

    interface DeviceContext {
        getInfo: DeviceInfo | Object
    }

    interface AppInfo {

    }

    interface DeviceInfo {

    }

    interface ExtensionSettings {
        get(key: string, cb: Function)
    }

    interface Meta {
        userId?: string
        appId: string,
        deviceId: string
        requestId?: string
    }

    interface ContextStorage {
        extension: Storage
        device: Storage
        user: Storage
    }

    interface Storage {
        get(key: string, cb: Function),

        set(key: string, value: any, cb: Function),

        del(key: string, cb: Function)
    }
}
