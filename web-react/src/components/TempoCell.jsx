import Unit from './Unit.jsx'

/** TEMPO · KEY · TRUE PEAK — hardware digit cells. */
export default function TempoCell({ bpm = 124, keyName = 'Am', truePeak = -0.8, read = '' }) {
  const Cell = ({ v, l }) => (
    <div className="hairline flex-1 rounded-xl bg-panel2 px-3 pb-3 pt-3.5 text-center">
      <b dir="ltr" className="digits block text-[26px] font-semibold"
         style={{ textShadow: '0 0 16px rgba(61,245,166,.35)' }}>{v}</b>
      <span className="digits mt-1.5 block text-[8.5px] uppercase tracking-[.22em] text-faint">{l}</span>
    </div>
  )
  return (
    <Unit area="tempo" label="Tempo · Key" read={read}>
      <div className="flex gap-3.5">
        <Cell v={bpm} l="BPM" />
        <Cell v={keyName} l="KEY" />
        <Cell v={`${truePeak}dB`} l="TRUE PEAK" />
      </div>
    </Unit>
  )
}
