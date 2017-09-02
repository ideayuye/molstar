
import { parse } from '../gro'
// import { Table } from '../../relational/table'

const groString = `MD of 2 waters, t= 4.2
    6
    1WATER  OW1    1   0.126   1.624   1.679  0.1227 -0.0580  0.0434
    1WATER  HW2    2   0.190   1.661   1.747  0.8085  0.3191 -0.7791
    1WATER  HW3    3   0.177   1.568   1.613 -0.9045 -2.6469  1.3180
    2WATER  OW1    4   1.275   0.053   0.622  0.2519  0.3140 -0.1734
    2WATER  HW2    5   1.337   0.002   0.680 -1.0641 -1.1349  0.0257
    2WATER  HW3    6   1.326   0.120   0.568  1.9427 -0.8216 -0.0244
   1.82060   1.82060   1.82060`

describe('gro reader', () => {
    it('basic', () => {
        const parsed = parse(groString)

        if (parsed.isError) {
            console.log(parsed)
        } else {
            const groFile = parsed.result

            const header = groFile.blocks[0].getTable('header')
            if (header) {
                expect(header.columnNames).toEqual(['title', 'timeInPs', 'numberOfAtoms', 'boxX', 'boxY', 'boxZ'])

                expect(header.getColumn('title').getString(0)).toBe('MD of 2 waters')
                expect(header.getColumn('timeInPs').getFloat(0)).toBeCloseTo(4.2)
                expect(header.getColumn('numberOfAtoms').getInteger(0)).toBe(6)

                expect(header.getColumn('boxX').getFloat(0)).toBeCloseTo(1.82060)
                expect(header.getColumn('boxY').getFloat(0)).toBeCloseTo(1.82060)
                expect(header.getColumn('boxZ').getFloat(0)).toBeCloseTo(1.82060)
            } else {
                console.error('no header')
            }
        }
    })
});
