import { SettingsJsonModel } from "@game/settings/SettingsJsonModel"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

export class Settings {
    private static instance: Settings
    private static readonly SETTINGS_KEY = "game_settings"

    public static getInstance(): Settings {
        if (!Settings.instance) {
            Settings.instance = new Settings()
        }
        return Settings.instance
    }

    private _isAudioMuted: boolean = false
    private _isMusicMuted: boolean = false

    public set isAudioMuted(value: boolean) {
        this._isAudioMuted = value
    }

    public get isAudioMuted() {
        return this._isAudioMuted
    }

    public set isMusicMuted(value: boolean) {
        this._isMusicMuted = value
    }

    public get isMusicMuted() {
        return this._isMusicMuted
    }

    public async save() {
        await this.saveJsonModel({
            isAudioMuted: this._isAudioMuted,
            isMusicMuted: this._isMusicMuted,
        })
    }

    public async load() {
        const jsonModel = await this.loadJsonModel()
        if (jsonModel) {
            this._isAudioMuted = jsonModel.isAudioMuted
            this._isMusicMuted = jsonModel.isMusicMuted ?? false
        }
    }

    private async saveJsonModel(jsonModel: SettingsJsonModel) {
        const item = JSON.stringify(jsonModel)
        await RundotGameAPI.deviceCache.setItem(Settings.SETTINGS_KEY, item)
    }

    private async loadJsonModel(): Promise<SettingsJsonModel | null> {
        const item = await RundotGameAPI.deviceCache.getItem(Settings.SETTINGS_KEY)
        if (!item) return null
        return JSON.parse(item) as SettingsJsonModel
    }
}
