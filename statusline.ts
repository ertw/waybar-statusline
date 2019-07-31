import fs from 'fs'
import child_process from 'child_process'
import util from 'util'
import moment, { Moment } from 'moment'
const { promisify } = util
const readFile = promisify(fs.readFile)
const exec = promisify(child_process.exec)

type BatteryStatus = 'Charging' | 'Discharging' | 'Full' | 'Unknown'

type ShouldDisplay = true | false

interface StatusItems {
    batteryStatus: string
    _batteryStatus: string
    batteryCapacity: number
    _batteryCapacity: string
    _formattedBatteryInfo: string
    ssid: [string, ShouldDisplay]
    _ssid: string
    ping: [number, ShouldDisplay]
    _ping: string
    date: Moment
    _date: string
}

class StatusLine {
    constructor() {
        [
            { func: this.setBatteryStatus, time: 2000 },
            { func: this.setBatteryCapacity, time: 10000 },
            { func: this.setSsid, time: 5000 },
            { func: this.setPing, time: 5000 },
        ].map(_ => { _.func(); setInterval(_.func, _.time) })
    }

    private statusLine: StatusItems = {
        batteryStatus: '...',
        _batteryStatus: '',
        batteryCapacity: 0,
        _batteryCapacity: '',
        _formattedBatteryInfo: '',
        ssid: ['...', false],
        _ssid: '',
        ping: [0, false],
        _ping: '',
        date: moment(),
        _date: ''
    }

    private shouldDisplay(tuple: [any, ShouldDisplay]) {
        return tuple[1]
    }

    private async *execCommand(command: string) {
        try {
            while (true) {
                const { stdout, stderr } = await exec(command)
                yield { stdout, stderr, error: false }
            }
        } catch (error) {
            return { stdout: null, stderr: null, error: true }
        }
    }

    private setBatteryCapacity = async () => {
        const batteryCapacity = await readFile('/sys/class/power_supply/BAT0/capacity', 'utf8')
        this.statusLine.batteryCapacity = parseInt(batteryCapacity)
        this.setFormattedBatteryInfo()
    }

    private get batteryCapacity(): string {
        return (this.statusLine.batteryCapacity <= 100 ? this.statusLine.batteryCapacity.toString() : 'Full')
    }

    private setBatteryStatus = async () => {
        const status = await readFile('/sys/class/power_supply/BAT0/status', 'utf8') as BatteryStatus
        const icons: Array<[BatteryStatus, string]> = [
            ['Charging', '⭫🔌'],
            ['Discharging', '⭭🔋'],
            ['Full', '🔌'],
            ['Unknown', '⚡'],
        ]
        const icon = icons.find(tuple => tuple[0] === status.trim()) || ['Unknown', '⚡']
        this.statusLine.batteryStatus = icon[1]
        this.setFormattedBatteryInfo()
    }

    private get batteryStatus(): string {
        return this.statusLine.batteryStatus
    }

    private setSsid = async () => {
        const command = 'iwgetid -r'
        const result = await this.execCommand(command).next()
        const { stdout, stderr, error } = result.value
        if (stdout) {
            this.statusLine.ssid = [stdout.trim(), true]
            this.statusLine._ssid = `📶 ${this.statusLine.ssid[0]}`
        }
        if (error || stderr) {
            this.statusLine.ssid[1] = false
        }
    }

    private get _ssid() {
        return this.shouldDisplay(this.statusLine.ssid) ? this.statusLine._ssid : null
    }

    private setFormattedBatteryInfo = () => {
        this.statusLine._formattedBatteryInfo = `${this.batteryStatus} ${this.batteryCapacity.trim()}%`
    }

    private get _formattedBatteryInfo() {
        return this.statusLine._formattedBatteryInfo
    }

    private setPing = async () => {
        const command = "ping -c 1 www.bing.com | awk -F '/' 'END {print $5}'"
        const result = await this.execCommand(command).next()
        const { stdout, stderr } = result.value
        const ping = stdout && stderr === '' ? parseInt(stdout.trim()) : -1
        if (ping >= 0) {
            this.statusLine.ping = [ping, true]
            this.statusLine._ping = `🌩 ${isNaN(this.statusLine.ping[0]) ? 'drop' : this.statusLine.ping[0] + 'ms'}`
        } else {
            this.statusLine.ping = [0, false]
        }
    }

    private get _ping() {
        return this.shouldDisplay(this.statusLine.ping) ? this.statusLine._ping : null
    }

    private setDate = () => {
        this.statusLine.date = moment()
        this.statusLine._date = `${this.statusLine.date.format('ddd D-MMM   HH:mm:ss')}`
    }

    private get _date(): string {
        return this.statusLine._date
    }

    public printStatusLine = async () => {
        this.setDate()
        console.log(
            [
                this._ping,
                this._formattedBatteryInfo,
                this._ssid,
                this._date,
            ]
                .filter(x => x !== null)
                .map(x => `${x}  `)
                .join(`   `)
        )
    }
}

const statusLine = new StatusLine

const main = async () => {
    setInterval(statusLine.printStatusLine, 1000)
}

main()