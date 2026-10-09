import AuthBrandPanel from './AuthBrandPanel.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

function SkylineArt() {
  return (
    <div className="auth-page-art" aria-hidden="true">
      <svg viewBox="0 0 1440 180" fill="none" preserveAspectRatio="none">
        <path d="M0 154H1440" stroke="currentColor" strokeWidth="2" />
        <path d="M20 154V94h86v60m-70-42h12m18 0h20m-50 19h12m18 0h20M126 154V62h108v92m-88-72h14m20 0h14m-48 22h14m20 0h14m-48 22h14m20 0h14M264 154v-46h74v46m-56-30h38m-38 15h38M364 154V42l64-34 62 34v112m-102-80h20m32 0h20m-72 25h20m32 0h20m-72 25h20m32 0h20m-48 24h34v-24m-20 24v-38" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M518 154V82h74v72m-56-52h38m-38 20h38m-19-20v52M618 154v-98h104v98m-84-76h14m22 0h14m-50 24h14m22 0h14m-50 24h14m22 0h14M748 154v-48h86v48m-66-29h46m-46 15h46M860 154V68h100v86m-80-64h14m24 0h14m-52 22h14m24 0h14m-52 22h14m24 0h14M984 154V42l62-34 64 34v112m-102-80h20m32 0h20m-72 25h20m32 0h20m-72 25h20m32 0h20m-48 24h34v-24m-20 24v-38" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M1154 154V94h88v60m-68-40h48m-48 20h48m-24-20v40M1270 154v-90h104v90m-84-68h14m22 0h14m-50 24h14m22 0h14m-50 24h14m22 0h14M145 154V95m-16 12c2-19 12-29 24-31-1 17-8 27-24 31Zm16-17c2-17 11-25 23-27-1 15-9 24-23 27Zm0 0c-1-16-9-24-21-27 0 14 8 24 21 27ZM690 154V95m-16 12c2-19 12-29 24-31-1 17-8 27-24 31Zm16-17c2-17 11-25 23-27-1 15-9 24-23 27Zm0 0c-1-16-9-24-21-27 0 14 8 24 21 27ZM1110 154V95m-16 12c2-19 12-29 24-31-1 17-8 27-24 31Zm16-17c2-17 11-25 23-27-1 15-9 24-23 27Zm0 0c-1-16-9-24-21-27 0 14 8 24 21 27Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function AuthPageLayout({ children }) {
  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <div className="auth-topbar-brand" aria-label="StreetSetu">
          <span className="brand-mark">S</span>
          <strong>StreetSetu</strong>
        </div>
        <LanguageSwitcher />
      </header>
      <div className="auth-layout">
        <AuthBrandPanel />
        {children}
      </div>
      <SkylineArt />
    </main>
  );
}
