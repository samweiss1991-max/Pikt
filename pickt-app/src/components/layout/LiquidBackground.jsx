export default function LiquidBackground() {
  return (
    <>
      <div className="fixed inset-0 -z-10 liquid-bg pointer-events-none" />
      <div className="fixed top-[-10%] right-[-5%] w-96 h-96 bg-primary-container/20 blur-[100px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-96 h-96 bg-secondary-container/10 blur-[100px] rounded-full -z-10 pointer-events-none" />
    </>
  )
}
