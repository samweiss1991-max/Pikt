const GRADIENTS = [
  ['#2d7235', '#1f652a'],
  ['#865c00', '#765100'],
  ['#78716c', '#44403c'],
  ['#1f652a', '#14532d'],
  ['#4b6c4c', '#3f6041'],
  ['#a16207', '#854d0e'],
]

export function getAvatarGradient(index) {
  const [from, to] = GRADIENTS[index % GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}
