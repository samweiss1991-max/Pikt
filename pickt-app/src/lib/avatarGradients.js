// Avatars carry white initials, so every gradient stays dark enough
// for white text (navy + slate from the palette in tokens.css).
const GRADIENTS = [
  ['#002366', '#001845'],
  ['#374151', '#1F2937'],
  ['#1E3A6E', '#002366'],
  ['#4B5563', '#374151'],
]

export function getAvatarGradient(index) {
  const [from, to] = GRADIENTS[index % GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}
