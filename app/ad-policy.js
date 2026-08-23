"use client";

import { useEffect } from "react";

const CLIENT = "ca-pub-3450079984401603";

export default function AdPolicy() {
  useEffect(() => {
    let loaded = false;

    const applyPolicy = () => {
      if (loaded || document.querySelector("script[data-study-adsense]")) return;
      let session = null;
      try { session = JSON.parse(localStorage.getItem("study-flow-session") || "null"); } catch {}

      // 연령 미확인 및 만 14세 미만 로컬 모드는 스크립트 자체를 로드하지 않는다.
      if (!session?.user || session.user.localOnly || session.user.isChild) return;

      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.requestNonPersonalizedAds = 1;
      // Google의 통합 TFAT 값 2(TEEN)를 스크립트 요청 전에 설정한다.
      window.google_tag_for_age_treatment = 2;
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.studyAdsense = "true";
      script.dataset.privacyTreatments = "disablePersonalization";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      document.head.appendChild(script);
      loaded = true;
    };

    applyPolicy();
    window.addEventListener("study-session-changed", applyPolicy);
    return () => window.removeEventListener("study-session-changed", applyPolicy);
  }, []);

  return null;
}
