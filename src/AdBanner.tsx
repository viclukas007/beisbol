import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';

type Ads = { desktopUrl: string | null; mobileUrl: string | null };
export default function AdBanner() {
  const [ads, setAds] = useState<Ads>({ desktopUrl: null, mobileUrl: null });
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [failed, setFailed] = useState(false);
  const url = mobile ? (ads.mobileUrl ?? ads.desktopUrl) : (ads.desktopUrl ?? ads.mobileUrl);
  const portraitAsset = mobile ? Boolean(ads.mobileUrl) : !ads.desktopUrl && Boolean(ads.mobileUrl);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const result = await fetch('/api/ads', { cache: 'no-store' });
        if (result.ok && alive) setAds(await result.json());
      } catch { /* Keep the reserved space when a sponsor file is not available. */ }
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    const media = window.matchMedia('(max-width: 760px)');
    const resize = () => setMobile(media.matches);
    media.addEventListener('change', resize);
    return () => { alive = false; clearInterval(timer); media.removeEventListener('change', resize); };
  }, []);
  useEffect(() => { setFailed(false); }, [url]);
  return <aside className="advertisement" aria-label="Publicidad de patrocinadores">
    <div className="ad-heading"><span>PUBLICIDAD</span><span>Patrocinadores del torneo</span></div>
    <div className={`ad-space ${portraitAsset ? 'mobile-asset' : ''}`}>
      {url && !failed ? <a className="ad-link" href="https://agentesmonos.com/" target="_blank" rel="noopener noreferrer" aria-label="Visitar Agentes AI (abre una pestaña nueva)"><video key={url} src={url} autoPlay muted loop playsInline preload="auto" aria-label="Video del patrocinador" onError={()=>setFailed(true)}/></a> : <div className="ad-placeholder"><Shield size={22} strokeWidth={1.3}/><span>Espacio para patrocinadores</span></div>}
    </div>
  </aside>;
}
