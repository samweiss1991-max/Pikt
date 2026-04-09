export default function NavBadge({ count }) {
  if (!count || count <= 0) return null

  return (
    <span className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center bg-primary text-on-primary text-[10px] font-black px-1">
      {count > 99 ? '99+' : count}
    </span>
  )
}
