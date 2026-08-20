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

      // 연령을 확인하지 못한 방문자와 초등학생 계정에는 광고 코드를 전혀
      // 로드하지 않는다. 중·고등학생 계정도 행동 기반 맞춤 광고는 요청하지 않는다.
      if (!session?.user || session.user.isChild) return;

      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.requestNonPersonalizedAds = 1;
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
