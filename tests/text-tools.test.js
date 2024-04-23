const { hasTextElements } = require('../lib/text-tools')

describe('hasTextElements works as expected when not using jaroDistance and', () => {
  test('we want match on all matchElements, and all are in the textElements', () => {
    const textElements = ['Shrek', 'kul som et troll', 'er', 'jaudia', 'klaudia']
    const matchElements = ['Shrek', 'er', 'kul som et troll']
    const match = hasTextElements(textElements, matchElements)
    expect(match).toBe(true)
  })
  test('we want match on all matchElements, but one is missing from the textElements', () => {
    const textElements = ['Shrek', 'kul som et fjoll', 'er', 'jaudia', 'klaudia']
    const matchElements = ['Shrek', 'er', 'kul som et troll']
    const match = hasTextElements(textElements, matchElements)
    expect(match).toBe(false)
  })
  test('we want match on at least four matchElements, and at least four are present in textElements', () => {
    const textElements = ['Shrek', 'kul som et troll', 'er', 'jaudia', 'klaudia', 'Dette er bra']
    const matchElements = ['Shrek', 'er', 'kul som et troll', 'Dette er bra', 'mimimi', 'simimimi']
    const match = hasTextElements(textElements, matchElements, { matchThreshold: 4 })
    expect(match).toBe(true)
  })
  test('we want match on at least four out of six words, but only three are present in text', () => {
    const textElements = ['Shrek', 'kul som et troll', 'er', 'jaudia', 'klaudia']
    const matchElements = ['Shrek', 'er', 'kul som et troll', 'Dette er bra', 'mimimi', 'simimimi']
    const match = hasTextElements(textElements, matchElements, { matchThreshold: 4 })
    expect(match).toBe(false)
  })
})

describe('hasTextElements works as expected when using jaroDistance and', () => {
  test('we want match on all matchElements, and similar elements are in textElements', () => {
    const textElements = ['Shrek din breshe', 'hettern', 'skuleste', 'tyren']
    const matchElements = ['Shrek den freshe', 'fettern', 'kuleste', 'fyren']
    const match = hasTextElements(textElements, matchElements, { jaroThreshold: 0.8, verboseJaro: true })
    expect(match).toBe(true)
  })
  test('we want match on all matchElements, and similar elements are in textElements,  but not similar enough', () => {
    const textElements = ['Shrek din breshe', 'hettern', 'skuleste', 'tyren']
    const matchElements = ['Shrek den freshe', 'fettern', 'kuleste', 'fyren']
    const match = hasTextElements(textElements, matchElements, { jaroThreshold: 0.9, verboseJaro: true })
    expect(match).toBe(false)
  })
  test('we want match on at least 2 matchElements, and similar elements are in textElements', () => {
    const textElements = ['Shrek din breshe gubbe', 'hettern', 'skuleste', 'tyren']
    const matchElements = ['Shrek den freshe gubbe', 'fettern', 'kuleste', 'fyren']
    const match = hasTextElements(textElements, matchElements, { jaroThreshold: 0.9, matchThreshold: 2, verboseJaro: true })
    expect(match).toBe(true)
  })
})
