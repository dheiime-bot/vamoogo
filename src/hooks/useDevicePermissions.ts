import { useEffect } from "react";

/**
 * Solicita as permissões nativas do dispositivo (localização e câmera) logo no
 * carregamento do app. No navegador isso só dispara o prompt quando a API é
 * chamada — então fazemos uma chamada "leve" para acionar o pedido.
 *
 * Estratégia:
 * 1. Consulta o estado atual via Permissions API (quando suportada).
 * 2. Se ainda for "prompt" (nunca decidida), aciona a API correspondente para
 *    abrir o diálogo nativo do navegador/SO.
 * 3. Marca em sessionStorage para não repetir na mesma sessão.
 */
export const useDevicePermissions = () => {
  useEffect(() => {
    const KEY = "vamoo:perm-asked";
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");

    const askGeolocation = async () => {
      if (!("geolocation" in navigator)) return;
      try {
        // @ts-ignore - 'geolocation' é válido em navigator.permissions
        const status = await navigator.permissions?.query({ name: "geolocation" });
        if (status && status.state === "granted") return;
        // Aciona o prompt
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } catch {
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
      }
    };

    const askCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return;
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
