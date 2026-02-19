export class Timer {
    private _elapsedTime: number = 0
    private _duration: number = 0

    public get elapsedTime(): number {
        return this._elapsedTime
    }

    public get duration(): number {
        return this._duration
    }

    public set duration(value: number) {
        this._duration = value
    }

    constructor(duration: number) {
        this._duration = duration
    }

    public tick(dt: number) {
        this._elapsedTime += dt
    }
    public isDone(): boolean {
        return this._elapsedTime >= this._duration
    }

    public isRunning(): boolean {
        return this._elapsedTime < this._duration
    }

    public reset() {
        this._elapsedTime = 0
    }

    public getProgress(): number {
        return this._elapsedTime / this._duration
    }

    public trigger() {
        this._elapsedTime = this._duration
    }
}
