import { useEffect } from "react";
import { initGpsTracker } from "@/lib/gpsTracker";

/**
 * Solicita as permissões nativas do dispositivo (localização e câmera) logo no
 * carregamento do app. Estratégia (revisada):
 * 1. SEMPRE tenta acionar o GPS no boot (sem flag de sessão), garantindo que o
 *    prompt apareça e que o navegador inicialize o subsistema de localização.
 * 2. Faz duas chamadas em paralelo: uma de baixa precisão (rápida, dá certo
 *    em desktops/notebooks sem GPS) e outra de alta precisão (mobile/GPS real).
 *    Assim a UI ganha posição em poucos segundos mesmo com GPS lento.
 * 3. Em caso de PERMISSION_DENIED, ainda tentamos novamente sempre que o app é
 *    aberto — o navegador apenas reabre o prompt se o usuário não o tiver
 *    bloqueado permanentemente. Câmera continua sendo pedida 1x por sessão
 *    para não atrapalhar.
 */
export const useDevicePermissions = () => {
  useEffect(() => {
    const CAM_KEY = "vamoo:perm-cam-asked";

    const askGeolocation = async () => {
      if (!("geolocation" in navigator)) return;
      // Inicializa o tracker GLOBAL: abre um único watchPosition contínuo que
      // alimenta um cache em memória e fica vivo durante toda a sessão. Assim,
      // quando o motorista clica em Ficar Online, a posição já está pronta e
      // o upsert no banco acontece em milissegundos.
      initGpsTracker();
      try {
        // @ts-ignore - 'geolocation' é válido em navigator.permissions
        const status = await navigator.permissions?.query({ name: "geolocation" });
        // Se já estiver concedido, ainda assim "aquece" o GPS para acelerar a
        // primeira leitura quando o motorista clicar em Ficar Online.
        // Disparamos baixa + alta precisão em paralelo (o que vier primeiro vence).
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
        );
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }
        );
        // Reage à mudança de permissão (usuário aceita depois): nada a fazer
        // aqui além de reabrir o prompt na próxima ação do usuário; deixamos o
        // listener disponível caso outras telas queiram observar.
        if (status && "onchange" in status) {
          // noop: cada tela que precisa de GPS já trata seu próprio fluxo
        }
      } catch {
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
          { enableHighAccuracy: false, timeout: 5000 }
        );
      }
    };

    const askCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return;
      if (sessionStorage.getItem(CAM_KEY)) return;
      sessionStorage.setItem(CAM_KEY, "1");
      try {
        // @ts-ignore - 'camera' é válido em navigator.permissions em alguns browsers
        const status = await navigator.permissions?.query({ name: "camera" });
        if (status && status.state === "granted") return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Encerra imediatamente — só queríamos o prompt
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Usuário negou ou navegador não suporta — silencioso
      }
    };

    // Sequencial para não abrir 2 prompts ao mesmo tempo (alguns browsers bloqueiam)
    (async () => {
      await askGeolocation();
      // Pequeno delay para o segundo prompt aparecer depois do primeiro
      setTimeout(askCamera, 1200);
    })();
  }, []);
};
