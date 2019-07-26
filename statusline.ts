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
        this.setBatteryStatus()
        setInterval(() => this.setBatteryStatus(), 2000)

        this.setBatteryCapacity()
        setInterval(() => this.setBatteryCapacity(), 10000)

        this.setSsid()
        setInterval(() => this.setSsid(), 5000)

        this.setPing()
        setInterval(() => this.setPing(), 5000)
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
        try {
            const { stdout, stderr } = await exec('iwgetid -r')
            if (stdout) {
                this.statusLine.ssid = [stdout.trim(), true]
                this.statusLine._ssid = `📶 ${this.statusLine.ssid[0]}`
            }
            if (stderr) {
                this.statusLine.ssid[1] = false
            }
        } catch (error) {
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
        try {
            const { stdout, stderr } = await exec("ping -c 1 www.bing.com | awk -F '/' 'END {print $5}'")
            if (stdout) {
                this.statusLine.ping = [parseInt(stdout.trim()), true]
                this.statusLine._ping = `🌩 ${this.statusLine.ping[0]}ms`
            }
            if (stderr) {
                this.statusLine.ping = [0, false]
            }
        } catch (error) {
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