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
    batteryCapacity: number
    ssid: [string, ShouldDisplay]
    _ssid: string
    ping: [number, ShouldDisplay]
    _ping: string
    date: Moment
    _date: string
    readonly batteryIcons: Array<[BatteryStatus, string]>
    readonly batteryPath: string
    readonly commands: {
        ping: string
        iwgetid: string
    }
    readonly dateFormat: string
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

    private state: StatusItems = {
        batteryStatus: '...',
        batteryCapacity: 0,
        ssid: ['...', false],
        _ssid: '',
        ping: [0, false],
        _ping: '',
        date: moment(),
        _date: '',
        batteryIcons: [
            ['Charging', '⭫🔌'],
            ['Discharging', '⭭🔋'],
            ['Full', '🔌'],
            ['Unknown', '⚡'],
        ],
        batteryPath: '/sys/class/power_supply/BAT0/',
        commands: {
            ping: "ping -c 1 www.bing.com | awk -F '/' 'END {print $5}'",
            iwgetid: 'iwgetid -r',
        },
        dateFormat: 'ddd D-MMM   HH:mm:ss',
    }

    private shouldDisplay(tuple: [any, ShouldDisplay]) {
        return tuple[1]
    }

    private async *execCommand(command: string) {
        try {
            const { stdout, stderr } = await exec(command)
            while (true) {
                yield { stdout, stderr, error: false }
            }
        } catch (error) {
            return { stdout: null, stderr: null, error: true }
            console.error(error)
        }
    }

    private setBatteryCapacity = async () => {
        try {
            const batteryCapacity = await readFile(this.state.batteryPath + 'capacity', 'utf8')
            this.state.batteryCapacity = parseInt(batteryCapacity)
        } catch (error) {
            console.error(error)
        }
    }

    private setBatteryStatus = async () => {
        try {
            const status = await readFile(this.state.batteryPath + 'status', 'utf8') as BatteryStatus
            const icon = this.state.batteryIcons.find(tuple => tuple[0] === status.trim()) || ['Unknown', '⚡']
            this.state.batteryStatus = icon[1]
        } catch (error) {
            console.error(error)

        }
    }

    private setSsid = async () => {
        try {
            const result = await this.execCommand(this.state.commands.iwgetid).next()
            const { stdout, stderr, error } = result.value
            if (stdout) {
                this.state.ssid = [stdout.trim(), true]
                this.state._ssid = `📶 ${this.state.ssid[0]}`
            }
            if (error || stderr) {
                this.state.ssid[1] = false
            }
        } catch (error) {
            console.error(error)
        }
    }

    private get _ssid() {
        return this.shouldDisplay(this.state.ssid) ? this.state._ssid : null
    }

    private get formattedBatteryInfo() {
        return `${this.state.batteryStatus} ${this.state.batteryCapacity}%`
    }

    private setPing = async () => {
        const result = await this.execCommand(this.state.commands.ping).next()
        const { stdout, stderr } = result.value
        const ping = stdout && stderr === '' ? parseInt(stdout.trim()) : -1
        if (ping >= 0) {
            this.state.ping = [ping, true]
            this.state._ping = `🌩 ${isNaN(this.state.ping[0]) ? 'drop' : this.state.ping[0] + 'ms'}`
        } else {
            this.state.ping = [0, false]
        }
    }

    private get _ping() {
        return this.shouldDisplay(this.state.ping) ? this.state._ping : null
    }

    private setDate = () => {
        this.state.date = moment()
        this.state._date = `${this.state.date.format(this.state.dateFormat)}`
    }

    private get _date(): string {
        return this.state._date
    }

    public printStatusLine = async () => {
        this.setDate()
        console.log(
            [
                this._ping,
                this.formattedBatteryInfo,
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