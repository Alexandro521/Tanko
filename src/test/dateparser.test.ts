
import { timeSkipFormater, timeStringToInt } from "../utils.ts";
import chalk from "chalk";
import {expect, test} from "bun:test";
const ftest = [
'2005-14-13',
'2005-50-12 15:03',
'2005-03-13 03:04:50',
'2026-50-14 30:60:45.458',
'2007-52-14T14:32',
'2016-59-32T19:14:60',
'2026-14-30T17:14:17.478',
'19:08',
'09:28:14',
'30:14:29.282',
'+0001-06-01 12:50:00.1234',
'1792191214',
'now',
] as const
test('test time formats parser', () => {
    ftest.forEach((e) => {
        try {
            const obj = timeStringToInt(e, false)
        } catch (err) {
            console.log(chalk.red('[FAILED]:') + `"${e}"`)
        }
    })
})

const timeDiff = [
'+0000-00-00 00:00:00.1234',
'+0000-00-00 00:00:60.1234',
'+0000-00-00 00:50:60.1234',
'+0000-00-00 12:50:60.1234',
'+0000-00-01 12:50:60.1234',
'+0000-06-01 12:50:60.1234',
'+0001-06-01 12:50:60.1234'
] as const

test('parse timeString', ()=>{
    expect(timeSkipFormater(timeDiff[0])).toBe('Now')
    expect(timeSkipFormater(timeDiff[1])).toBe('60 Seconds ago')
    expect(timeSkipFormater(timeDiff[2])).toBe('50 Minutes ago')
    expect(timeSkipFormater(timeDiff[3])).toBe('12 Hours ago')
    expect(timeSkipFormater(timeDiff[4])).toBe('One Day ago')
    expect(timeSkipFormater(timeDiff[5])).toBe('6 Months ago')
    expect(timeSkipFormater(timeDiff[6])).toBe('One Year ago')
})