export interface CityLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  city: string;
  state?: string;
  category: "airport" | "hospital" | "school" | "university" | "shopping" | "market" | "restaurant" | "gas_station" | "pharmacy" | "park" | "bus_station" | "government" | "church" | "bank" | "hotel" | "landmark" | "neighborhood" | "street" | "supermarket" | "mall" | "station" | "terminal" | "gym" | "beach" | "theater" | "museum";
}

export const getCategoryLabel = (cat: CityLocation["category"]): string => {
  const labels: Record<string, string> = {
    airport: "Aeroporto", hospital: "Hospital", school: "Escola", university: "Universidade",
    shopping: "Shopping", market: "Mercado", restaurant: "Restaurante", gas_station: "Posto",
    pharmacy: "Farmácia", park: "Praça/Parque", bus_station: "Rodoviária", government: "Órgão Público",
    church: "Igreja", bank: "Banco", hotel: "Hotel", landmark: "Referência",
    neighborhood: "Bairro", street: "Rua", supermarket: "Supermercado", mall: "Shopping",
    station: "Estação", terminal: "Terminal", gym: "Academia", beach: "Praia",
    theater: "Teatro", museum: "Museu",
  };
  return labels[cat] || cat;
};

export const getCategoryIcon = (cat: CityLocation["category"]): string => {
  const icons: Record<string, string> = {
    airport: "✈️", hospital: "🏥", school: "🏫", university: "🎓",
    shopping: "🛍️", market: "🛒", restaurant: "🍽️", gas_station: "⛽",
    pharmacy: "💊", park: "🌳", bus_station: "🚌", government: "🏛️",
    church: "⛪", bank: "🏦", hotel: "🏨", landmark: "📍",
    neighborhood: "🏘️", street: "🛣️", supermarket: "🛒", mall: "🛍️",
    station: "🚉", terminal: "🚌", gym: "🏋️", beach: "🏖️",
    theater: "🎭", museum: "🏛️",
  };
  return icons[cat] || "📍";
};

const altamiraLocations: CityLocation[] = [
  { id: "alt-airport", name: "Aeroporto de Altamira", address: "Rod. Ernesto Acioli, Km 2", lat: -3.2539, lng: -52.2540, city: "Altamira", category: "airport" },
  { id: "alt-hrp", name: "Hospital Regional Público da Transamazônica", address: "Av. Perimetral, s/n - Mutirão", lat: -3.2156, lng: -52.2089, city: "Altamira", category: "hospital" },
  { id: "alt-hsa", name: "Hospital Santo Agostinho", address: "Trav. Pedro Gomes, 544 - Centro", lat: -3.2024, lng: -52.2082, city: "Altamira", category: "hospital" },
  { id: "alt-upa", name: "UPA 24h Altamira", address: "Rua Coronel José Porfírio, s/n", lat: -3.2098, lng: -52.2123, city: "Altamira", category: "hospital" },
  { id: "alt-policlinica", name: "Policlínica Municipal", address: "Av. Tancredo Neves, 2000 - Brasília", lat: -3.2180, lng: -52.2045, city: "Altamira", category: "hospital" },
  { id: "alt-esc-rui", name: "Escola Estadual Rui Barbosa", address: "Rua Coronel José Porfírio, 1100 - Centro", lat: -3.2048, lng: -52.2070, city: "Altamira", category: "school" },
  { id: "alt-esc-marista", name: "Escola Dom Amando", address: "Trav. Augusto Corrêa, 150 - Centro", lat: -3.2010, lng: -52.2060, city: "Altamira", category: "school" },
  { id: "alt-esc-irma", name: "Escola Irmã Dorothy", address: "Av. Djalma Dutra, s/n - Mutirão", lat: -3.2120, lng: -52.2150, city: "Altamira", category: "school" },
  { id: "alt-esc-abel", name: "Escola Abel Figueiredo", address: "Rua Osvaldo Cruz, 500 - Centro", lat: -3.2035, lng: -52.2100, city: "Altamira", category: "school" },
  { id: "alt-esc-prof", name: "Escola Prof. Anísio Teixeira", address: "Rua Cel. Gaioso, 890 - Jardim Independente I", lat: -3.2195, lng: -52.1988, city: "Altamira", category: "school" },
  { id: "alt-ufpa", name: "UFPA - Campus Altamira", address: "Rua Coronel José Porfírio, 2515 - São Sebastião", lat: -3.2150, lng: -52.1950, city: "Altamira", category: "university" },
  { id: "alt-unama", name: "UNAMA Altamira", address: "Av. Djalma Dutra, 1100 - Esplanada do Xingu", lat: -3.2075, lng: -52.2130, city: "Altamira", category: "university" },
  { id: "alt-ifpa", name: "IFPA - Campus Altamira", address: "Rua Porto de Moz, s/n - Peixaria", lat: -3.1985, lng: -52.2060, city: "Altamira", category: "university" },
  { id: "alt-atacadao", name: "Atacadão Altamira", address: "Rod. Transamazônica, Km 3", lat: -3.2205, lng: -52.1920, city: "Altamira", category: "supermarket" },
  { id: "alt-formosa", name: "Supermercado Formosa", address: "Av. Tancredo Neves, 1200 - Centro", lat: -3.2055, lng: -52.2095, city: "Altamira", category: "supermarket" },
  { id: "alt-nazare", name: "Supermercado Nazaré", address: "Rua Cel. José Porfírio, 800 - Centro", lat: -3.2030, lng: -52.2078, city: "Altamira", category: "supermarket" },
  { id: "alt-biglar", name: "Supermercado Big Lar", address: "Av. Perimetral, 400 - Mutirão", lat: -3.2170, lng: -52.2110, city: "Altamira", category: "supermarket" },
  { id: "alt-machado", name: "Supermercado Machado", address: "Trav. Cel. Gaioso, 300 - Brasília", lat: -3.2140, lng: -52.2000, city: "Altamira", category: "supermarket" },
  { id: "alt-mercado-mun", name: "Mercado Municipal", address: "Av. Djalma Dutra, s/n - Orla do Xingu", lat: -3.1990, lng: -52.2080, city: "Altamira", category: "market" },
  { id: "alt-posto-br", name: "Posto BR - Transamazônica", address: "Rod. Transamazônica, Km 1", lat: -3.2160, lng: -52.2020, city: "Altamira", category: "gas_station" },
  { id: "alt-posto-ipiranga", name: "Posto Ipiranga Centro", address: "Av. Tancredo Neves, 800 - Centro", lat: -3.2040, lng: -52.2085, city: "Altamira", category: "gas_station" },
  { id: "alt-posto-shell", name: "Posto Shell Xingu", address: "Rua Cel. José Porfírio, 2000", lat: -3.2100, lng: -52.2010, city: "Altamira", category: "gas_station" },
  { id: "alt-posto-ale", name: "Posto Ale Mutirão", address: "Av. Perimetral, 800 - Mutirão", lat: -3.2185, lng: -52.2140, city: "Altamira", category: "gas_station" },
  { id: "alt-farm-pague", name: "Farmácia Pague Menos", address: "Av. Tancredo Neves, 900 - Centro", lat: -3.2045, lng: -52.2088, city: "Altamira", category: "pharmacy" },
  { id: "alt-farm-big", name: "Big Farma", address: "Rua Cel. José Porfírio, 600 - Centro", lat: -3.2020, lng: -52.2072, city: "Altamira", category: "pharmacy" },
  { id: "alt-farm-pop", name: "Farmácia Popular", address: "Trav. Pedro Gomes, 300 - Centro", lat: -3.2015, lng: -52.2065, city: "Altamira", category: "pharmacy" },
  { id: "alt-farm-drog", name: "Drogaria Xingu", address: "Av. Djalma Dutra, 500 - Esplanada", lat: -3.2060, lng: -52.2100, city: "Altamira", category: "pharmacy" },
  { id: "alt-praca-biblia", name: "Praça da Bíblia", address: "Rua Cel. José Porfírio - Centro", lat: -3.2015, lng: -52.2075, city: "Altamira", category: "park" },
  { id: "alt-orla", name: "Orla do Xingu", address: "Av. Beira Rio, s/n - Centro", lat: -3.1980, lng: -52.2070, city: "Altamira", category: "park" },
  { id: "alt-praca-tiradentes", name: "Praça Tiradentes", address: "Rua Osvaldo Cruz - Centro", lat: -3.2025, lng: -52.2090, city: "Altamira", category: "park" },
  { id: "alt-rodoviaria", name: "Rodoviária de Altamira", address: "Av. Perimetral, s/n", lat: -3.2110, lng: -52.2130, city: "Altamira", category: "terminal" },
  { id: "alt-prefeitura", name: "Prefeitura Municipal", address: "Rua Cel. José Porfírio, 200 - Centro", lat: -3.2008, lng: -52.2068, city: "Altamira", category: "government" },
  { id: "alt-forum", name: "Fórum de Altamira", address: "Trav. Augusto Corrêa, 500 - Centro", lat: -3.2030, lng: -52.2055, city: "Altamira", category: "government" },
  { id: "alt-delegacia", name: "Delegacia de Polícia Civil", address: "Rua Magalhães Barata, 300", lat: -3.2038, lng: -52.2045, city: "Altamira", category: "government" },
  { id: "alt-detran", name: "DETRAN Altamira", address: "Rod. Transamazônica, Km 2", lat: -3.2200, lng: -52.1960, city: "Altamira", category: "government" },
  { id: "alt-correios", name: "Correios Altamira", address: "Rua Cel. José Porfírio, 400", lat: -3.2018, lng: -52.2070, city: "Altamira", category: "government" },
  { id: "alt-catedral", name: "Catedral São Sebastião", address: "Praça da Bíblia - Centro", lat: -3.2012, lng: -52.2073, city: "Altamira", category: "church" },
  { id: "alt-igreja-batista", name: "Igreja Batista Central", address: "Rua Osvaldo Cruz, 200", lat: -3.2028, lng: -52.2095, city: "Altamira", category: "church" },
  { id: "alt-assembleia", name: "Assembleia de Deus", address: "Av. Tancredo Neves, 1500", lat: -3.2090, lng: -52.2040, city: "Altamira", category: "church" },
  { id: "alt-bb", name: "Banco do Brasil", address: "Av. Tancredo Neves, 500 - Centro", lat: -3.2035, lng: -52.2080, city: "Altamira", category: "bank" },
  { id: "alt-caixa", name: "Caixa Econômica Federal", address: "Rua Cel. José Porfírio, 700", lat: -3.2025, lng: -52.2075, city: "Altamira", category: "bank" },
  { id: "alt-bradesco", name: "Bradesco Altamira", address: "Av. Tancredo Neves, 600", lat: -3.2038, lng: -52.2083, city: "Altamira", category: "bank" },
  { id: "alt-itau", name: "Itaú Altamira", address: "Rua Cel. José Porfírio, 850", lat: -3.2032, lng: -52.2077, city: "Altamira", category: "bank" },
  { id: "alt-hotel-xingu", name: "Hotel Xingu", address: "Rua Cel. José Porfírio, 1500", lat: -3.2065, lng: -52.2050, city: "Altamira", category: "hotel" },
  { id: "alt-hotel-bela", name: "Hotel Bela Vista", address: "Av. Djalma Dutra, 800", lat: -3.2050, lng: -52.2110, city: "Altamira", category: "hotel" },
  { id: "alt-rest-tia", name: "Restaurante da Tia Doca", address: "Orla do Xingu, s/n", lat: -3.1985, lng: -52.2075, city: "Altamira", category: "restaurant" },
  { id: "alt-rest-peixaria", name: "Peixaria do Xingu", address: "Av. Beira Rio, 200", lat: -3.1992, lng: -52.2068, city: "Altamira", category: "restaurant" },
  { id: "alt-rest-sabor", name: "Sabor da Terra", address: "Rua Osvaldo Cruz, 100", lat: -3.2020, lng: -52.2092, city: "Altamira", category: "restaurant" },
  { id: "alt-bairro-centro", name: "Centro", address: "Centro, Altamira - PA", lat: -3.2020, lng: -52.2080, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-mutirao", name: "Mutirão", address: "Mutirão, Altamira - PA", lat: -3.2170, lng: -52.2150, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-brasilia", name: "Brasília", address: "Brasília, Altamira - PA", lat: -3.2150, lng: -52.2010, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-esplanada", name: "Esplanada do Xingu", address: "Esplanada do Xingu, Altamira", lat: -3.2060, lng: -52.2120, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-jardim1", name: "Jardim Independente I", address: "Jardim Independente I, Altamira", lat: -3.2195, lng: -52.1980, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-jardim2", name: "Jardim Independente II", address: "Jardim Independente II, Altamira", lat: -3.2230, lng: -52.1940, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-boa-esp", name: "Boa Esperança", address: "Boa Esperança, Altamira", lat: -3.2100, lng: -52.2200, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-liberdade", name: "Liberdade", address: "Liberdade, Altamira", lat: -3.2080, lng: -52.1950, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-sudam1", name: "SUDAM I", address: "SUDAM I, Altamira", lat: -3.2250, lng: -52.2050, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-sudam2", name: "SUDAM II", address: "SUDAM II, Altamira", lat: -3.2280, lng: -52.2070, city: "Altamira", category: "neighborhood" },
  { id: "alt-bairro-aparecida", name: "Aparecida", address: "Aparecida, Altamira", lat: -3.1960, lng: -52.2100, city: "Altamira", category: "neighborhood" },
  { id: "alt-ponte-xingu", name: "Ponte sobre o Rio Xingu", address: "Rod. Transamazônica", lat: -3.2130, lng: -52.2300, city: "Altamira", category: "landmark" },
  { id: "alt-porto", name: "Porto de Altamira", address: "Orla do Xingu, Centro", lat: -3.1975, lng: -52.2065, city: "Altamira", category: "landmark" },
  { id: "alt-norte-energia", name: "Escritório Norte Energia (Belo Monte)", address: "Av. Tancredo Neves, 2200", lat: -3.2130, lng: -52.1970, city: "Altamira", category: "landmark" },
  { id: "alt-rua-cel", name: "Rua Coronel José Porfírio", address: "Rua principal do Centro", lat: -3.2040, lng: -52.2075, city: "Altamira", category: "street" },
  { id: "alt-av-tancredo", name: "Avenida Tancredo Neves", address: "Av. Tancredo Neves", lat: -3.2070, lng: -52.2060, city: "Altamira", category: "street" },
  { id: "alt-av-djalma", name: "Avenida Djalma Dutra", address: "Av. Djalma Dutra", lat: -3.2050, lng: -52.2115, city: "Altamira", category: "street" },
  { id: "alt-av-perimetral", name: "Avenida Perimetral", address: "Av. Perimetral", lat: -3.2165, lng: -52.2120, city: "Altamira", category: "street" },
  { id: "alt-rod-trans", name: "Rodovia Transamazônica (BR-230)", address: "BR-230, Altamira", lat: -3.2200, lng: -52.2000, city: "Altamira", category: "street" },
];

const allLocations: CityLocation[] = [...altamiraLocations];

export const searchLocations = (query: string, limit = 10): CityLocation[] => {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return allLocations
    .filter((loc) => {
      const searchable = `${loc.name} ${loc.address} ${loc.city} ${getCategoryLabel(loc.category)}`
        .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return searchable.includes(q);
    })
    .slice(0, limit);
};

export const getPopularLocations = (city?: string, limit = 8): CityLocation[] => {
  const priority = ["airport", "hospital", "supermarket", "market", "terminal", "university", "landmark", "park"];
  let locs = city ? allLocations.filter((l) => l.city.toLowerCase() === city.toLowerCase()) : allLocations;
  locs = [...locs].sort((a, b) => {
    const ai = priority.indexOf(a.category);
    const bi = priority.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return locs.slice(0, limit);
};

export const getCityLocations = (city: string): CityLocation[] => {
  return allLocations.filter((l) => l.city.toLowerCase() === city.toLowerCase());
};
