import Link from "next/link";

export function SiteHeader() {
  return (
    <nav className="public-nav" aria-label="주요 메뉴">
      <Link className="brand" href="/">공부<span>하자!</span></Link>
      <div>
        <Link href="/">플래너</Link>
        <Link href="/guides">학습 가이드</Link>
        <Link href="/about">서비스 소개</Link>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="public-footer">
      <div>
        <Link className="brand" href="/">공부<span>하자!</span></Link>
        <p>학생이 오늘 할 일을 분명하게 만드는 무료 시험 공부 도구</p>
      </div>
      <nav aria-label="사이트 정보">
        <Link href="/about">소개</Link>
        <Link href="/guides">학습 가이드</Link>
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/terms">이용약관</Link>
        <Link href="/#planner-start">플래너 시작</Link>
      </nav>
      <p>© 2026 공부하자. All rights reserved.</p>
    </footer>
  );
}
