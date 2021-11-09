import { TestBed } from '@angular/core/testing';
import { equal, typeOf, fraction } from 'mathjs';
import { rerollUpToOneDice } from '@models/reroll-function';

import { DiceRollsService } from './dice-rolls.service';

function customEqualityTestForFractions(first: any, second: any): boolean | undefined {
  if (typeOf(first) === 'Fraction' || typeOf(second) === 'Fraction') {
    return equal(first, second) as boolean
  }
  return undefined
}

describe('DiceRollsService', () => {
  let service: DiceRollsService

  beforeEach(() => {
    jasmine.addCustomEqualityTester(customEqualityTestForFractions)
    TestBed.configureTestingModule({})
    service = TestBed.inject(DiceRollsService)
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })


  describe('probabilityToGetSuccesses', () => {
    describe('1 dice on 3+', () => {
      it('0 success = 2/6', () => {
        expect(service.probabilityToGetSuccesses(1, fraction(4, 6), 0)).toEqual(fraction(2, 6))
      })
      it('1 success = 4/6', () => {
        expect(service.probabilityToGetSuccesses(1, fraction(4, 6), 1)).toEqual(fraction(4, 6))
      })
    })

    describe('2 dice on 4+', () => {
      it('0 success = 1/4', () => {
        expect(service.probabilityToGetSuccesses(2, fraction(3, 6), 0)).toEqual(fraction(1, 4))
      })
      it('1 success = 1/2', () => {
        expect(service.probabilityToGetSuccesses(2, fraction(3, 6), 1)).toEqual(fraction(1, 2))
      })
      it('3 success = 1/4', () => {
        expect(service.probabilityToGetSuccesses(2, fraction(3, 6), 2)).toEqual(fraction(1, 4))
      })
    })
  })


  describe('tableOfProbilitiesToGetSuccesses', () => {
    it('0 dice on 4+', () => {
      expect(service.tableOfProbilitiesToGetSuccesses(0, fraction(3, 6))).toEqual(new Map([
        [0, fraction(1)],
      ]))
    })
    it('1 dice on 3+', () => {
      expect(service.tableOfProbilitiesToGetSuccesses(1, fraction(4, 6))).toEqual(new Map([
        [0, fraction(2, 6)],
        [1, fraction(4, 6)],
      ]))
    })
    it('2 dice on 4+', () => {
      expect(service.tableOfProbilitiesToGetSuccesses(2, fraction(3, 6))).toEqual(new Map([
        [0, fraction(1, 4)],
        [1, fraction(2, 4)],
        [2, fraction(1, 4)],
      ]))
    })
  })

  describe('hitsTable', () => {
    it('attack: 1, melee: 3+', () => {
      expect(service.hitsTable({ attack: 1, melee: 3 })).toEqual(new Map([
        [0, fraction(2, 6)],
        [1, fraction(4, 6)],
      ]))
    })
    it('attack: 1, melee: 3+, reroll ones', () => {
      expect(service.hitsTable({ attack: 1, melee: 3, rerollFunctions: [rerollAllOnes()] })).toEqual(new Map([
        [0, fraction(16, 72)],
        [1, fraction(56, 72)],
      ]))
    })
    it('attack: 2, melee: 4+, reroll up to 1 dice', () => {
      expect(service.hitsTable({ attack: 2, melee: 4, rerollFunctions: [rerollUpToOneDice()] })).toEqual(new Map([
        [0, fraction(1, 8)],
        [1, fraction(3, 8)],
        [2, fraction(4, 8)],
      ]))
    })
    it('attack: 1, melee: 4+, blast D3', () => {
      expect(service.hitsTable({ attack: 1, melee: 4, blast: { dice: 3 } })).toEqual(new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 6)],
        [2, fraction(1, 6)],
        [3, fraction(1, 6)],
      ]))
    })
    it('attack: 1, melee: 4+, blast D6', () => {
      expect(service.hitsTable({ attack: 1, melee: 4, blast: { dice: 6 } })).toEqual(new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 12)],
        [2, fraction(1, 12)],
        [3, fraction(1, 12)],
        [4, fraction(1, 12)],
        [5, fraction(1, 12)],
        [6, fraction(1, 12)],
      ]))
    })
    it('attack: 1, melee: 4+, blast D3 + 1', () => {
      expect(service.hitsTable({ attack: 1, melee: 4, blast: { dice: 3, plus: 1 } })).toEqual(new Map([
        [0, fraction(1, 2)],
        [1, fraction(0)],
        [2, fraction(1, 6)],
        [3, fraction(1, 6)],
        [4, fraction(1, 6)],
      ]))
    })
    it('attack: 2, melee: 4+, blast D3', () => {
      expect(service.hitsTable({ attack: 2, melee: 4, blast: { dice: 3 } })).toEqual(new Map([
        [0, fraction(1, 4)],
        [1, fraction(1, 6)],
        [2, fraction(7, 36)],
        [3, fraction(8, 36)],
        [4, fraction(3, 36)],
        [5, fraction(2, 36)],
        [6, fraction(1, 36)],
      ]))
    })
    it('attack: 1, melee: 4+, blast undefined', () => {
      expect(service.hitsTable({ attack: 1, melee: 4, blast: { } })).toEqual(new Map([
        [0, fraction(1, 1)],
      ]))
    })
    it('attack: 1, melee: 4+, blast 1', () => {
      expect(service.hitsTable({ attack: 1, melee: 4, blast: { plus: 1 } })).toEqual(new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 2)],
      ]))
    })
    it('attack: 1, melee: 4+, blast 2', () => {
      expect(service.hitsTable({ attack: 1, melee: 4, blast: { plus: 2} })).toEqual(new Map([
        [0, fraction(1, 2)],
        [1, fraction(0, 1)],
        [2, fraction(1, 2)],
      ]))
    })
  })
  
  describe('woundsTable', () => {
    it('attack: 1, melee: 4+, defense: 4+', () => {
      const hitsTable = service.hitsTable({ attack: 1, melee: 4 })
      const woundsTable = service.woundsTable(hitsTable, 4, [])
      expect(woundsTable).toEqual(new Map([
        [0, fraction(3, 4)],
        [1, fraction(1, 4)],
      ]))
    })
    it('attack: 2, melee: 4+, defense: 4+', () => {
      const hitsTable = service.hitsTable({ attack: 2, melee: 4 })
      const woundsTable = service.woundsTable(hitsTable, 4, [])
      expect(woundsTable).toEqual(new Map([
        [0, fraction(9, 16)],
        [1, fraction(6, 16)],
        [2, fraction(1, 16)],
      ]))
    })
    it('attack: 2, melee: 4+, defense: 4+', () => {
      const hitsTable = service.hitsTable({ attack: 2, melee: 4 })
      const woundsTable = service.woundsTable(hitsTable, 4, [])
      expect(woundsTable).toEqual(new Map([
        [0, fraction(9, 16)],
        [1, fraction(6, 16)],
        [2, fraction(1, 16)],
      ]))
    })
    it('attack: 3, melee: 6+, defense: 3+, elite and vicious', () => {
      const hitsTable = service.hitsTable({ attack: 3, melee: 6, rerollFunctions: [rerollAllOnes()]})
      const woundsTable = service.woundsTable(hitsTable, 3, [rerollAllOnes()])
      expect(woundsTable).toEqual(new Map([
        [0, fraction(20796875, 34012224)],
        [1, fraction(3705625, 11337408)],
        [2, fraction(660275, 11337408)],
        [3, fraction(117649, 34012224)],
      ]))
    })
  })

  describe('combineTables', () => {
    it('combine [50%, 50%] and [50%, 50%]', () => {
      const tableA = new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 2)],
      ])
      const tableB = new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 2)],
      ])
      expect(service.combineTwoTables(tableA, tableB)).toEqual(new Map([
        [0, fraction(1, 4)],
        [1, fraction(2, 4)],
        [2, fraction(1, 4)],
      ]))
    })
    it('combine [75%, 25%] and [75%, 25%]', () => {
      const tableA = new Map([
        [0, fraction(3, 4)],
        [1, fraction(1, 4)],
      ])
      const tableB = new Map([
        [0, fraction(3, 4)],
        [1, fraction(1, 4)],
      ])
      expect(service.combineTwoTables(tableA, tableB)).toEqual(new Map([
        [0, fraction(9, 16)],
        [1, fraction(6, 16)],
        [2, fraction(1, 16)],
      ]))
    })
    it('combine [50%, 50%] and [75%, 25%]', () => {
      const tableA = new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 2)],
      ])
      const tableB = new Map([
        [0, fraction(3, 4)],
        [1, fraction(1, 4)],
      ])
      expect(service.combineTwoTables(tableA, tableB)).toEqual(new Map([
        [0, fraction(3, 8)],
        [1, fraction(4, 8)],
        [2, fraction(1, 8)],
      ]))
    })
  })
  
  describe('differenceTable', () => {
    it('between [50%, 50%] and [50%, 50%]', () => {
      const tableA = new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 2)],
      ])
      const tableB = new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 2)],
      ])
      expect(service.differenceTable(tableA, tableB)).toEqual(new Map([
        [0, fraction(0)],
        [1, fraction(0)],
      ]))
    })
    it('between [75%, 25%] and [50%, 50%]', () => {
      const tableA = new Map([
        [0, fraction(3, 4)],
        [1, fraction(1, 4)],
      ])
      const tableB = new Map([
        [0, fraction(1, 2)],
        [1, fraction(1, 2)],
      ])
      expect(service.differenceTable(tableA, tableB)).toEqual(new Map([
        [0, fraction(1, 4)],
        [1, fraction(-1, 4)],
      ]))
    })
  })
})