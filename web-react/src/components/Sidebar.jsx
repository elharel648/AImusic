/** Fixed start-side navigation — the platform's spine (Linear/Vercel grammar). */
const NAV = [
  { id: 'dash', label: 'דשבורד', icon: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z', active: true },
  { id: 'tracks', label: 'השירים שלי', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', href: '/' },
  { id: 'analytics', label: 'AI אנליטיקס', icon: 'M3 3v18h18M7 14l4-4 4 2 5-6' },
  { id: 'settings', label: 'הגדרות', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1l-.4-2.6H10.2l-.4 2.6a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.6h4.6l.4-2.6a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z' },
]

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-[232px] flex-col border-e border-white/10 bg-[#0a0a0a] lg:flex">
      {/* logo area */}
      <div className="flex items-center gap-2.5 border-b border-white/[.07] px-5 py-[18px]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-sig/10 text-sig shadow-[0_0_14px_-4px_var(--color-sig)]">
          <svg width="14" height="14" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="5">
            <circle cx="32" cy="34" r="19" /><path d="M32 34 L43.5 22" strokeLinecap="round" />
          </svg>
        </span>
        <span className="digits text-[13px] font-semibold tracking-[.18em]">A&R·AI</span>
        <span className="digits ms-auto rounded border border-white/10 px-1.5 py-0.5 text-[8px] tracking-[.2em] text-faint">BETA</span>
      </div>

      {/* nav */}
      <nav className="flex flex-col gap-1 p-3">
        {NAV.map(item => {
          const cls = `group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition
            ${item.active
              ? 'bg-white/[.06] text-ink shadow-[inset_2px_0_0_var(--color-sig)]'
              : 'text-dim hover:bg-white/[.04] hover:text-ink'}`
          const inner = (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                   className={item.active ? 'text-sig' : 'text-faint group-hover:text-dim'}>
                <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
              {!item.active && !item.href && (
                <span className="digits ms-auto text-[8px] uppercase tracking-[.14em] text-faint">soon</span>
              )}
            </>
          )
          return item.href
            ? <a key={item.id} href={item.href} className={cls}>{inner}</a>
            : <button key={item.id} className={cls} disabled={!item.active}>{inner}</button>
        })}
      </nav>

      {/* user snippet pinned to the floor */}
      <div className="mt-auto flex items-center gap-3 border-t border-white/[.07] px-4 py-3.5">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-panel2 text-[11px] font-semibold text-dim">H</span>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] text-ink">האורח שלנו</div>
          <div className="digits text-[9px] uppercase tracking-[.16em] text-faint">free · beta</div>
        </div>
      </div>
    </aside>
  )
}
