import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { LangProvider } from './i18n/index.jsx'
import { SessionProvider } from './session.jsx'
import Shell from './shell/Shell.jsx'
import Report from './screens/Report.jsx'
import Library from './screens/Library.jsx'
import Compare from './screens/Compare.jsx'
import Batch from './screens/Batch.jsx'
import Accuracy from './screens/Accuracy.jsx'
import Show from './screens/Show.jsx'
import Stage from './screens/Stage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <SessionProvider>
          <Routes>
            <Route index element={<Stage />} />
            <Route path="show" element={<Show />} />
            <Route element={<Shell />}>
              <Route path="report" element={<Report />} />
              <Route path="library" element={<Library />} />
              <Route path="compare" element={<Compare />} />
              <Route path="batch" element={<Batch />} />
              <Route path="accuracy" element={<Accuracy />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </SessionProvider>
      </BrowserRouter>
    </LangProvider>
  </StrictMode>,
)
