import fs from 'fs'
import child_process from 'child_process'
import util from 'util'
import moment, { Moment } from 'moment'
const { promisify } = util
const readFile = promisify(fs.readFile);
const exec = promisify(child_process.exec);

type Status = 'Charging' | 'Discharging' | 'Full' | 'Unknown'

interface StatusItems {
    batteryStatus: string
    batteryCapacity: number
    ssid: string
    ping: number
    date: Moment
}

class StatusLine {
    constructor() {
        this.setBatteryStatus()
        setInterval(() => this.setBatteryStatus(), 2000);

        this.setBatteryCapacity()
        setInterval(() => this.setBatteryCapacity(), 10000);

        this.setSsid()
        setInterval(() => this.setSsid(), 5000);

        this.setPing()
        setInterval(() => this.setPing(), 5000);
    }

    private statusLine: StatusItems = {
        batteryStatus: '...',
        batteryCapacity: 0,
        ssid: '...',
        ping: 0,
        date: moment()
    }

    private setBatteryStatus = async () => {
        const status = await readFile('/sys/class/power_supply/BAT0/status', 'utf8') as Status
        switch (status.trim()) {
            case 'Charging': {
                this.statusLine.batteryStatus = '⭫🔌'
                break
            }
            case 'Discharging': {
                this.statusLine.batteryStatus = '⭭🔋'
                break
            }
            case 'Full': {
                this.statusLine.batteryStatus = '🔌'
                break
            }
            case 'Unknown': {
                this.statusLine.batteryStatus = '⚡'
                break
            }
            default: {
                this.statusLine.batteryStatus = '...'
                break
            }
        }
    }

    private setBatteryCapacity = async () => {
        const batteryCapacity = await readFile('/sys/class/power_supply/BAT0/capacity', 'utf8')
        this.statusLine.batteryCapacity = parseInt(batteryCapacity)
    }

    public get batteryCapacity(): string {
        return (this.statusLine.batteryCapacity <= 100 ? this.statusLine.batteryCapacity.toString() : 'Full')
    }

    public get batteryStatus(): string {
        return this.statusLine.batteryStatus
    }

    private setSsid = async () => {
        const { stdout, stderr } = await exec('iwgetid -r')
        this.statusLine.ssid = stdout.trim()
    }

    public get ssid(): string {
        return this.statusLine.ssid
    }

    private setPing = async () => {
        const { stdout, stderr } = await exec("ping -c 1 www.bing.com | awk -F '/' 'END {print $5}'")
        this.statusLine.ping = parseInt(stdout.trim())
    }

    public get ping(): string {
        return this.statusLine.ping.toString()
    }

    private setDate = () => {
        this.statusLine.date = moment()
    }

    public get date(): string {
        return this.statusLine.date.format('ddd D-MMM   HH:mm:ss')
    }

    public printStatusLine = async () => {
        this.setDate()
        console.log(`⧙ 🌩 ${this.ping}ms ⧘   ⧙ ${this.batteryStatus} ${this.batteryCapacity.trim()}% ⧘   ⧙ 📶 ${this.ssid} ⧘   ⧙ ${this.date} ⧘  `)
    }
}

const statusLine = new StatusLine

const main = async () => {
    setInterval(statusLine.printStatusLine, 1000)
}

main()