import { Injectable } from '@angular/core';
import { add, factorial, fraction, MathType, max, min, multiply, pow, round, subtract } from 'mathjs';
import { Defender } from '@models/defender';
import { NerveTest } from '@models/nerve-test';
import { fromTo, fromZeroTo } from '../util';
import { DicePlusNumber } from '@app/models/dice-plus-number';

export type Melee = 2 | 3 | 4 | 5 | 6;

export function diceProbability(required: 1 | 2 | 3 | 4 | 5 | 6): MathType {
  return fraction(7 - required, 6)
}

export interface HitsParams {
  attack: number;
  melee: Melee;
  elite: boolean;
  rerollList: { amount: DicePlusNumber, onlyOnes: boolean }[];
  blast?: {
    dice?: 3 | 6;
    plus?: number;
  }
}

export interface WoundsParams {
  hitsTable: Map<number, MathType>;
  defense: 2|3|4|5|6;
  vicious: boolean;
  rerollList: { amount: DicePlusNumber, onlyOnes: boolean }[];
}

@Injectable({
  providedIn: 'root'
})
export class DiceRollsService {

  constructor() { }

  probabilityToGetSuccesses(diceRolled: number, diceSuccessProbability: MathType, amountOfSuccesses: number): MathType {
    const amountOfMisses = diceRolled - amountOfSuccesses
    const diceMissProbability = subtract(fraction(1), diceSuccessProbability)
    // round this because the factorial() gets rounding errors
    const a = round(factorial(diceRolled) / factorial(amountOfSuccesses) / factorial(amountOfMisses))
    const b = multiply(pow(diceSuccessProbability, amountOfSuccesses), pow(diceMissProbability, amountOfMisses))
    return multiply(a, b)
  }

  tableOfProbilitiesToGetSuccesses(diceRolled: number, diceSuccessProbability: MathType): Map<number, MathType> {
    // reserve an array from 0 to #diceRolled
    const entries = new Array(diceRolled + 1)
    for (const amountOfSuccesses of fromZeroTo(diceRolled)) {
      entries[amountOfSuccesses] = [amountOfSuccesses, this.probabilityToGetSuccesses(diceRolled, diceSuccessProbability, amountOfSuccesses)]
    }
    return new Map(entries)
  }

  hitsTable(params: HitsParams): Map<number, MathType> {
    let singleHitProbability = diceProbability(params.melee)
    if (params.elite) {
      // rerolling ones is the same as having 7/6 chance to hit each dice
      singleHitProbability = multiply(singleHitProbability, fraction(7, 6))
    }

    const finalTable = new Map<number, MathType>()
    for (const { willReroll, probabilityToRerollThisManyDice } of this.combineRerolls(params.rerollList)) {
      // will never be able to reroll more that the initial dice
      const topReroll = min(params.attack, willReroll)

      // add dice that will be rerolled to the normal dice, then remove that many dice
      let table = this.tableOfProbilitiesToGetSuccesses(params.attack + topReroll, singleHitProbability)
      if (params.blast) {
        table = this.applyBlast(table, params.attack, params.blast)
      }

      for (const [hits, hitsProbability] of table) {
        // remove dice added because of rerolls
        const realHits = min(hits, params.attack)

        const finalProbability = add(
          finalTable.get(realHits) ?? fraction(0),
          multiply(probabilityToRerollThisManyDice, hitsProbability),
        )

        finalTable.set(realHits, finalProbability)
      }
    }
    return finalTable
  }
  
  private combineRerolls(rerollList: { amount: DicePlusNumber, onlyOnes: boolean }[]): { willReroll: number; probabilityToRerollThisManyDice: MathType }[] {
    if (rerollList.length === 0) {
      return [
        { willReroll: 0, probabilityToRerollThisManyDice: fraction(1) }
      ]
    }

    const tables = rerollList.map(rerollItem => this.dicePlusNumberToTable(rerollItem.amount))
    let accumTable = tables[0]
    for (const otherTable of tables.slice(1)) {
      const newTable = new Map<number, MathType>()
      for (const [willRerollA, probA] of accumTable) {
        for (const [willRerollB, probB] of otherTable) {
          const prob = multiply(probA, probB)
          const willReroll = willRerollA + willRerollB
          newTable.set(willReroll, prob)
        }
      }
      accumTable = newTable
    }
    return [...accumTable.entries()].map(([willReroll, probabilityToRerollThisManyDice]) => ({ willReroll, probabilityToRerollThisManyDice}))
  }

  applyBlast(hitsTable: Map<number, MathType>, attack: number, blast: { dice?: 3 | 6, plus?: number }): Map<number, MathType> {
    const maxHitsAfterBlastPossible = attack * ((blast?.dice ?? 0) + (blast.plus ?? 0))
    const blastTable = Array(maxHitsAfterBlastPossible + 1).fill(0)
    blastTable[0] = hitsTable.get(0)
    for (const hits of fromTo(1, attack)) {
      const blastDiceSumTable = this.getDiceSumTable(hits, blast.dice ?? 0)
      for (const [blastDiceSum, blastDiceSumChance] of blastDiceSumTable.entries()) {
        const hitsAfterBlast = blastDiceSum + (blast.plus ?? 0) * hits
        blastTable[hitsAfterBlast] = add(
          blastTable[hitsAfterBlast],
          multiply(hitsTable.get(hits) ?? fraction(0), blastDiceSumChance),
        )
      }
    }
    return new Map(blastTable.entries())
  }

  getDiceSumTable(diceCount: number, diceMaxSide: number): MathType[] {
    if (diceCount <= 0 || diceMaxSide <= 0) {
      return [fraction(1)]
    }

    const sides = fromTo(1, diceMaxSide)
    let numerators = [1] // start at 0 dice; 100% of getting 0
    for (const die of fromTo(1, diceCount)) {
      const maxSum = diceMaxSide * die
      const newNumerators = Array(maxSum + 1).fill(0)
      for (const i of numerators.keys()) {
        for (const side of sides) {
          const sum = i + side
          newNumerators[sum] += numerators[i]
        }
      }
      numerators = newNumerators
    }
    const denominator = diceMaxSide ** diceCount
    return numerators.map(numerator => fraction(numerator, denominator))
  }

  woundsTable(params: WoundsParams): Map<number, MathType> {
    const woundsTable = new Map<number, MathType>()

    for (const [hits, hitsProbability] of params.hitsTable) {
      const woundsTableForThisHits = this.hitsTable({
        attack: hits,
        melee: params.defense,
        elite: params.vicious,
        rerollList: params.rerollList,
      })
      for (const [wounds, woundsPartialProbibility] of woundsTableForThisHits) {
        woundsTable.set(
          wounds,
          add(
            multiply(hitsProbability, woundsPartialProbibility),
            woundsTable.get(wounds) ?? fraction(0),
          )
        )
      }
    }

    return woundsTable
  }
  
  combineTables(tables: Map<number, MathType>[]): Map<number, MathType> {
    if (tables.length === 0) {
      return new Map()
    } else if (tables.length === 1) {
      return tables[0]
    } else {
      return this.combineTwoTables(tables[0], this.combineTables(tables.slice(1)))
    }
  }

  combineTwoTables(tableA: Map<number, MathType>, tableB: Map<number, MathType>): Map<number, MathType> {
    const combinedTable = new Map<number, MathType>()

    for (const entryA of tableA) {
      for (const entryB of tableB) {
        const wounds = entryA[0] + entryB[0]
        const probability = multiply(entryA[1], entryB[1])
        combinedTable.set(wounds, add(probability, combinedTable.get(wounds) ?? fraction(0)))
      }
    }

    return combinedTable
  }

  differenceTable(tableA: Map<number, MathType>, tableB: Map<number, MathType>): Map<number, MathType> {
    const differenceTable = new Map<number, MathType>()
    const maxWounds = max(...tableA.keys(), ...tableB.keys())
    for (let wounds of fromZeroTo(maxWounds)) {
      const probabilityDifference = subtract(
        tableA.get(wounds) ?? fraction(0),
        tableB.get(wounds) ?? fraction(0),
      )
      differenceTable.set(wounds, probabilityDifference)
    }
    return differenceTable
  }

  nerveTest(woundsTable: Map<number, MathType>, defender: Defender, nerveModifiers: DicePlusNumber[]): NerveTest {
    const nerveTest = <NerveTest>{
      steady: fraction(0),
      waver: fraction(0),
      rout: fraction(0),
    }

    // todo: implement brutal dice
    const nerveModificationTable: Map<number, MathType> = this.combineNerveModifiers(nerveModifiers)

    for (const [wounds, woundsProbability] of woundsTable) {
      // no nerve test if no wounds
      if (wounds === 0) {
        nerveTest.steady = add(nerveTest.steady, woundsProbability)
      } else {
        for (const [nerveModification, nerveModificationProbability] of nerveModificationTable) {
          const { steady, waver, rout } = this.nerveTestWithWounds(wounds + nerveModification, defender)
          nerveTest.steady = add(nerveTest.steady, multiply(multiply(woundsProbability, nerveModificationProbability), steady))
          nerveTest.waver = add(nerveTest.waver, multiply(multiply(woundsProbability, nerveModificationProbability), waver))
          nerveTest.rout = add(nerveTest.rout, multiply(multiply(woundsProbability, nerveModificationProbability), rout))
        }
      }
    }

    return nerveTest
  }

  private combineNerveModifiers(nerveModifiers: DicePlusNumber[]): Map<number, MathType> {
    if (nerveModifiers.length === 0) {
      return new Map([[0, fraction(1)]])
    }

    const tables = nerveModifiers.map(nerveModifier => this.dicePlusNumberToTable(nerveModifier))
    let accumTable = tables[0]
    for (const otherTable of tables.slice(1)) {
      const newTable = new Map<number, MathType>()
      for (const [nerveA, probA] of accumTable) {
        for (const [nerveB, probB] of otherTable) {
          const prob = multiply(probA, probB)
          const nerve = max(nerveA, nerveB)
          newTable.set(nerve, prob)
        }
      }
      accumTable = newTable
    }
    return accumTable
  }

  private dicePlusNumberToTable(value: DicePlusNumber): Map<number, MathType> {
    if (value.dice) {
      const table = new Map<number, MathType>()
      for (const diceResult of fromTo(1, value.dice)) {
        table.set(diceResult + (value.plus ?? 0), fraction(1, value.dice))
      }
      return table
    } else {
      return new Map([[value.plus ?? 0, fraction(1)]])
    }
  }

  private nerveTestWithWounds(wounds: number, defender: Defender): NerveTest {
    const sumTable2d6 = this.getDiceSumTable(2, 6)

    const toRout = defender.nerve.rout - wounds

    const toWaver =
      defender.nerve.waver === 'fearless' || defender.nerve.waver === 0 || !defender.nerve.waver
        ? 'fearless'
        : defender.nerve.waver - wounds
    
    const nerve = <NerveTest>{
      steady: fraction(0),
      waver: fraction(0),
      rout: fraction(0),
    }

    for (const [sum2d6, sum2d6probability] of sumTable2d6.entries()) {
      // double 1 is always steady
      // double 6 is waver if it didn't rout and if not fearless

      if (sum2d6 === 2) {
        nerve.steady = add(nerve.steady, sum2d6probability)
      } else if (sum2d6 >= toRout) {
        nerve.rout = add(nerve.rout, sum2d6probability)
      } else if (toWaver !== 'fearless' && (sum2d6 >= toWaver || sum2d6 === 12)) {
        nerve.waver = add(nerve.waver, sum2d6probability)
      } else {
        nerve.steady = add(nerve.steady, sum2d6probability)
      }
    }

    if (defender.inspired) {
      // reroll on 'rout'
      nerve.steady = add(nerve.steady, multiply(nerve.rout, nerve.steady))
      nerve.waver = add(nerve.waver, multiply(nerve.rout, nerve.waver))
      nerve.rout = multiply(nerve.rout, nerve.rout)
    }

    return nerve
  }

}
