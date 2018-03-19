interface Context {
    meta: Meta
    config: any
    storage: ContextStorage
    settings: ExtensionSettings
    app: AppContext
    device: DeviceContext
    log: Logger
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
