/**
 * externalNav — abre o Google Maps em nova aba/app com a rota traçada
 * a partir da posição atual do usuário até o destino informado.
 *
 * Em mobile, o link `https://www.google.com/maps/dir/...` abre direto
 * o app nativo do Google Maps (ou Waze, se configurado).
 */
export const openGoogleMapsRoute = (
  destLat: number,
  destLng: number,
  label?: string,
  waypoints: { lat: number; lng: number }[] = []
) => {
  if (!isFinite(destLat) || !isFinite(destLng)) return;
  const dest = `${destLat},${destLng}`;
  const waypointParam = waypoints.length > 0
    ? `&waypoints=${encodeURIComponent(waypoints.map((p) => `${p.lat},${p.lng}`).join("|"))}`
    : "";
  // origin=current location é deduzido pelo Google quando vazio
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    dest
  )}${waypointParam}&travelmode=driving${label ? `&dir_action=navigate` : "&dir_action=navigate"}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
