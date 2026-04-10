export interface CityLocation {
  id: string;
  name: string;
  address: string;
  category: "airport" | "hospital" | "school" | "university" | "supermarket" | "mall" | "park" | "station" | "terminal" | "government" | "church" | "gym" | "hotel" | "restaurant" | "pharmacy" | "gas_station" | "bank" | "beach" | "theater" | "museum";
  lat: number;
  lng: number;
  city: string;
}

const categoryLabels: Record<CityLocation["category"], string> = {
  airport: "✈️ Aeroporto",
  hospital: "🏥 Hospital",
  school: "🏫 Escola",
  university: "🎓 Universidade",
  supermarket: "🛒 Supermercado",
  mall: "🛍️ Shopping",
  park: "🌳 Parque",
  station: "🚉 Estação",
  terminal: "🚌 Terminal",
  government: "🏛️ Órgão Público",
  church: "⛪ Igreja",
  gym: "🏋️ Academia",
  hotel: "🏨 Hotel",
  restaurant: "🍽️ Restaurante",
  pharmacy: "💊 Farmácia",
  gas_station: "⛽ Posto",
  bank: "🏦 Banco",
  beach: "🏖️ Praia",
  theater: "🎭 Teatro",
  museum: "🏛️ Museu",
};

export const getCategoryLabel = (category: CityLocation["category"]) => categoryLabels[category];

export const cityLocations: CityLocation[] = [
  // === SÃO PAULO ===
  { id: "sp-01", name: "Aeroporto de Guarulhos (GRU)", address: "Rod. Hélio Smidt, s/n - Guarulhos, SP", category: "airport", lat: -23.4356, lng: -46.4731, city: "São Paulo" },
  { id: "sp-02", name: "Aeroporto de Congonhas (CGH)", address: "Av. Washington Luís, s/n - Campo Belo, SP", category: "airport", lat: -23.6261, lng: -46.6564, city: "São Paulo" },
  { id: "sp-03", name: "Hospital Albert Einstein", address: "Av. Albert Einstein, 627 - Morumbi, SP", category: "hospital", lat: -23.5996, lng: -46.7135, city: "São Paulo" },
  { id: "sp-04", name: "Hospital Sírio-Libanês", address: "R. Dona Adma Jafet, 91 - Bela Vista, SP", category: "hospital", lat: -23.5583, lng: -46.6537, city: "São Paulo" },
  { id: "sp-05", name: "Hospital das Clínicas (USP)", address: "R. Dr. Ovídio Pires de Campos, 225 - Cerqueira César, SP", category: "hospital", lat: -23.5568, lng: -46.6712, city: "São Paulo" },
  { id: "sp-06", name: "USP - Universidade de São Paulo", address: "R. da Reitoria, 374 - Butantã, SP", category: "university", lat: -23.5587, lng: -46.7318, city: "São Paulo" },
  { id: "sp-07", name: "PUC-SP", address: "R. Monte Alegre, 984 - Perdizes, SP", category: "university", lat: -23.5349, lng: -46.6872, city: "São Paulo" },
  { id: "sp-08", name: "Mackenzie", address: "R. da Consolação, 930 - Consolação, SP", category: "university", lat: -23.5475, lng: -46.6524, city: "São Paulo" },
  { id: "sp-09", name: "ETEC Paulistano", address: "Rua dos Bandeirantes, 169 - Bom Retiro, SP", category: "school", lat: -23.5275, lng: -46.6402, city: "São Paulo" },
  { id: "sp-10", name: "Colégio Bandeirantes", address: "R. Estela, 268 - Paraíso, SP", category: "school", lat: -23.5761, lng: -46.6449, city: "São Paulo" },
  { id: "sp-11", name: "Shopping Ibirapuera", address: "Av. Ibirapuera, 3103 - Moema, SP", category: "mall", lat: -23.6107, lng: -46.6667, city: "São Paulo" },
  { id: "sp-12", name: "Shopping Morumbi", address: "Av. Roque Petroni Júnior, 1089 - Morumbi, SP", category: "mall", lat: -23.6225, lng: -46.6984, city: "São Paulo" },
  { id: "sp-13", name: "Shopping Eldorado", address: "Av. Rebouças, 3970 - Pinheiros, SP", category: "mall", lat: -23.5731, lng: -46.6935, city: "São Paulo" },
  { id: "sp-14", name: "Shopping Center Norte", address: "Trav. Casalbuono, 120 - Vila Guilherme, SP", category: "mall", lat: -23.5147, lng: -46.6119, city: "São Paulo" },
  { id: "sp-15", name: "Extra Hipermercado - Morumbi", address: "Av. das Nações Unidas, 22540 - Jurubatuba, SP", category: "supermarket", lat: -23.6367, lng: -46.7081, city: "São Paulo" },
  { id: "sp-16", name: "Carrefour - Pinheiros", address: "R. Teodoro Sampaio, 2100 - Pinheiros, SP", category: "supermarket", lat: -23.5647, lng: -46.6911, city: "São Paulo" },
  { id: "sp-17", name: "Atacadão - Vila Mariana", address: "Av. Domingos de Morais, 2564 - Vila Mariana, SP", category: "supermarket", lat: -23.5914, lng: -46.6378, city: "São Paulo" },
  { id: "sp-18", name: "Pão de Açúcar - Paulista", address: "Av. Paulista, 2073 - Bela Vista, SP", category: "supermarket", lat: -23.5534, lng: -46.6623, city: "São Paulo" },
  { id: "sp-19", name: "Parque Ibirapuera", address: "Av. Pedro Álvares Cabral, s/n - Ibirapuera, SP", category: "park", lat: -23.5874, lng: -46.6576, city: "São Paulo" },
  { id: "sp-20", name: "Parque Villa-Lobos", address: "Av. Prof. Fonseca Rodrigues, 2001 - Alto de Pinheiros, SP", category: "park", lat: -23.5464, lng: -46.7246, city: "São Paulo" },
  { id: "sp-21", name: "Estação da Sé (Metrô)", address: "Praça da Sé, s/n - Sé, SP", category: "station", lat: -23.5505, lng: -46.6340, city: "São Paulo" },
  { id: "sp-22", name: "Estação Paulista (Metrô)", address: "Av. Paulista, s/n - Bela Vista, SP", category: "station", lat: -23.5567, lng: -46.6619, city: "São Paulo" },
  { id: "sp-23", name: "Estação Pinheiros (CPTM)", address: "R. Butantã, s/n - Pinheiros, SP", category: "station", lat: -23.5671, lng: -46.7020, city: "São Paulo" },
  { id: "sp-24", name: "Terminal Rodoviário Tietê", address: "Av. Cruzeiro do Sul, 1800 - Santana, SP", category: "terminal", lat: -23.5178, lng: -46.6263, city: "São Paulo" },
  { id: "sp-25", name: "Terminal Rodoviário Barra Funda", address: "R. Mário de Andrade, s/n - Barra Funda, SP", category: "terminal", lat: -23.5260, lng: -46.6663, city: "São Paulo" },
  { id: "sp-26", name: "Prefeitura de São Paulo", address: "Viaduto do Chá, 15 - Centro, SP", category: "government", lat: -23.5475, lng: -46.6382, city: "São Paulo" },
  { id: "sp-27", name: "Poupatempo Sé", address: "Praça do Carmo, s/n - Sé, SP", category: "government", lat: -23.5487, lng: -46.6309, city: "São Paulo" },
  { id: "sp-28", name: "Catedral da Sé", address: "Praça da Sé, s/n - Sé, SP", category: "church", lat: -23.5505, lng: -46.6340, city: "São Paulo" },
  { id: "sp-29", name: "Smart Fit - Paulista", address: "Av. Paulista, 1439 - Bela Vista, SP", category: "gym", lat: -23.5614, lng: -46.6563, city: "São Paulo" },
  { id: "sp-30", name: "Farmácia Drogasil - Consolação", address: "R. da Consolação, 2845 - Cerqueira César, SP", category: "pharmacy", lat: -23.5584, lng: -46.6686, city: "São Paulo" },
  { id: "sp-31", name: "Posto Ipiranga - Faria Lima", address: "Av. Faria Lima, 1811 - Jardim Paulistano, SP", category: "gas_station", lat: -23.5715, lng: -46.6894, city: "São Paulo" },
  { id: "sp-32", name: "Banco do Brasil - Centro", address: "R. São Bento, 405 - Centro, SP", category: "bank", lat: -23.5477, lng: -46.6335, city: "São Paulo" },
  { id: "sp-33", name: "MASP - Museu de Arte", address: "Av. Paulista, 1578 - Bela Vista, SP", category: "museum", lat: -23.5614, lng: -46.6559, city: "São Paulo" },
  { id: "sp-34", name: "Teatro Municipal de SP", address: "Praça Ramos de Azevedo, s/n - República, SP", category: "theater", lat: -23.5453, lng: -46.6387, city: "São Paulo" },
  { id: "sp-35", name: "Hotel Hilton Morumbi", address: "Av. das Nações Unidas, 12901 - Brooklin, SP", category: "hotel", lat: -23.6171, lng: -46.6990, city: "São Paulo" },

  // === RIO DE JANEIRO ===
  { id: "rj-01", name: "Aeroporto Santos Dumont (SDU)", address: "Praça Sen. Salgado Filho, s/n - Centro, RJ", category: "airport", lat: -22.9103, lng: -43.1631, city: "Rio de Janeiro" },
  { id: "rj-02", name: "Aeroporto Galeão (GIG)", address: "Av. Vinte de Janeiro, s/n - Ilha do Governador, RJ", category: "airport", lat: -22.8099, lng: -43.2505, city: "Rio de Janeiro" },
  { id: "rj-03", name: "Hospital Copa D'Or", address: "R. Figueiredo de Magalhães, 875 - Copacabana, RJ", category: "hospital", lat: -22.9668, lng: -43.1827, city: "Rio de Janeiro" },
  { id: "rj-04", name: "UFRJ - Campus Fundão", address: "Av. Pedro Calmon, 550 - Cidade Universitária, RJ", category: "university", lat: -22.8602, lng: -43.2234, city: "Rio de Janeiro" },
  { id: "rj-05", name: "Shopping Barra", address: "Av. das Américas, 4666 - Barra da Tijuca, RJ", category: "mall", lat: -22.9997, lng: -43.3628, city: "Rio de Janeiro" },
  { id: "rj-06", name: "Praia de Copacabana", address: "Av. Atlântica - Copacabana, RJ", category: "beach", lat: -22.9711, lng: -43.1823, city: "Rio de Janeiro" },
  { id: "rj-07", name: "Cristo Redentor", address: "Parque Nacional da Tijuca - Alto da Boa Vista, RJ", category: "museum", lat: -22.9519, lng: -43.2105, city: "Rio de Janeiro" },
  { id: "rj-08", name: "Rodoviária Novo Rio", address: "Av. Francisco Bicalho, 1 - Santo Cristo, RJ", category: "terminal", lat: -22.8989, lng: -43.2093, city: "Rio de Janeiro" },
  { id: "rj-09", name: "Supermercado Mundial - Tijuca", address: "R. Conde de Bonfim, 500 - Tijuca, RJ", category: "supermarket", lat: -22.9261, lng: -43.2332, city: "Rio de Janeiro" },
  { id: "rj-10", name: "Colégio Pedro II - Centro", address: "Campo de São Cristóvão, 177 - São Cristóvão, RJ", category: "school", lat: -22.9027, lng: -43.2202, city: "Rio de Janeiro" },

  // === BELO HORIZONTE ===
  { id: "bh-01", name: "Aeroporto de Confins (CNF)", address: "Rod. LMG-800, Km 7,9 - Confins, MG", category: "airport", lat: -19.6337, lng: -43.9686, city: "Belo Horizonte" },
  { id: "bh-02", name: "Hospital Mater Dei", address: "R. Gonçalves Dias, 2700 - Sto. Agostinho, BH", category: "hospital", lat: -19.9422, lng: -43.9529, city: "Belo Horizonte" },
  { id: "bh-03", name: "UFMG - Campus Pampulha", address: "Av. Pres. Antônio Carlos, 6627 - Pampulha, BH", category: "university", lat: -19.8719, lng: -43.9667, city: "Belo Horizonte" },
  { id: "bh-04", name: "Shopping Diamond Mall", address: "Av. Olegário Maciel, 1600 - Lourdes, BH", category: "mall", lat: -19.9334, lng: -43.9515, city: "Belo Horizonte" },
  { id: "bh-05", name: "Parque Municipal de BH", address: "Av. Afonso Pena, 1377 - Centro, BH", category: "park", lat: -19.9303, lng: -43.9365, city: "Belo Horizonte" },
  { id: "bh-06", name: "Rodoviária de BH", address: "Praça Rio Branco, 100 - Centro, BH", category: "terminal", lat: -19.9231, lng: -43.9332, city: "Belo Horizonte" },
  { id: "bh-07", name: "Supermercado EPA - Savassi", address: "R. Pernambuco, 1000 - Savassi, BH", category: "supermarket", lat: -19.9381, lng: -43.9378, city: "Belo Horizonte" },

  // === CURITIBA ===
  { id: "ct-01", name: "Aeroporto Afonso Pena (CWB)", address: "Av. Rocha Pombo, s/n - São José dos Pinhais, PR", category: "airport", lat: -25.5285, lng: -49.1758, city: "Curitiba" },
  { id: "ct-02", name: "UFPR - Campus Centro", address: "Praça Santos Andrade, 50 - Centro, Curitiba", category: "university", lat: -25.4296, lng: -49.2713, city: "Curitiba" },
  { id: "ct-03", name: "Shopping Estação", address: "Av. Sete de Setembro, 2775 - Rebouças, Curitiba", category: "mall", lat: -25.4397, lng: -49.2773, city: "Curitiba" },
  { id: "ct-04", name: "Parque Barigui", address: "BR-277, s/n - Sto. Inácio, Curitiba", category: "park", lat: -25.4224, lng: -49.3124, city: "Curitiba" },
  { id: "ct-05", name: "Rodoferroviária de Curitiba", address: "Av. Pres. Affonso Camargo, 330 - Jardim Botânico, Curitiba", category: "terminal", lat: -25.4384, lng: -49.2637, city: "Curitiba" },

  // === BRASÍLIA ===
  { id: "bs-01", name: "Aeroporto de Brasília (BSB)", address: "Lago Sul, Brasília - DF", category: "airport", lat: -15.8711, lng: -47.9186, city: "Brasília" },
  { id: "bs-02", name: "UnB - Universidade de Brasília", address: "Campus Universitário Darcy Ribeiro - Asa Norte, DF", category: "university", lat: -15.7631, lng: -47.8693, city: "Brasília" },
  { id: "bs-03", name: "Shopping Conjunto Nacional", address: "SDN Conj. A - Asa Norte, Brasília", category: "mall", lat: -15.7905, lng: -47.8828, city: "Brasília" },
  { id: "bs-04", name: "Rodoviária de Brasília", address: "Plataforma Superior, s/n - Plano Piloto, DF", category: "terminal", lat: -15.7940, lng: -47.8825, city: "Brasília" },
  { id: "bs-05", name: "Hospital de Base do DF", address: "SMHS Área Especial, Q. 101 - Asa Sul, DF", category: "hospital", lat: -15.7996, lng: -47.8914, city: "Brasília" },

  // === SALVADOR ===
  { id: "sa-01", name: "Aeroporto de Salvador (SSA)", address: "Praça Gago Coutinho, s/n - São Cristóvão, Salvador", category: "airport", lat: -12.9086, lng: -38.3311, city: "Salvador" },
  { id: "sa-02", name: "Shopping Barra - Salvador", address: "Av. Centenário, 2992 - Chame-Chame, Salvador", category: "mall", lat: -13.0096, lng: -38.5300, city: "Salvador" },
  { id: "sa-03", name: "Praia do Farol da Barra", address: "Av. Oceânica - Barra, Salvador", category: "beach", lat: -13.0101, lng: -38.5328, city: "Salvador" },
  { id: "sa-04", name: "UFBA - Campus Ondina", address: "R. Barão de Jeremoabo, s/n - Ondina, Salvador", category: "university", lat: -13.0008, lng: -38.5083, city: "Salvador" },

  // === RECIFE ===
  { id: "re-01", name: "Aeroporto dos Guararapes (REC)", address: "Praça Min. Salgado Filho, s/n - Imbiribeira, Recife", category: "airport", lat: -8.1264, lng: -34.9235, city: "Recife" },
  { id: "re-02", name: "Shopping Recife", address: "R. Padre Carapuceiro, 777 - Boa Viagem, Recife", category: "mall", lat: -8.1186, lng: -34.9044, city: "Recife" },
  { id: "re-03", name: "UFPE - Campus Recife", address: "Av. Prof. Moraes Rego, 1235 - Cidade Universitária, Recife", category: "university", lat: -8.0539, lng: -34.9510, city: "Recife" },
  { id: "re-04", name: "Praia de Boa Viagem", address: "Av. Boa Viagem - Boa Viagem, Recife", category: "beach", lat: -8.1226, lng: -34.8946, city: "Recife" },

  // === FORTALEZA ===
  { id: "fo-01", name: "Aeroporto Pinto Martins (FOR)", address: "Av. Senador Carlos Jereissati, 3000 - Serrinha, Fortaleza", category: "airport", lat: -3.7763, lng: -38.5326, city: "Fortaleza" },
  { id: "fo-02", name: "Shopping Iguatemi Fortaleza", address: "Av. Washington Soares, 85 - Edson Queiroz, Fortaleza", category: "mall", lat: -3.7696, lng: -38.4821, city: "Fortaleza" },
  { id: "fo-03", name: "Praia do Futuro", address: "Av. Dioguinho - Praia do Futuro, Fortaleza", category: "beach", lat: -3.7547, lng: -38.4627, city: "Fortaleza" },
  { id: "fo-04", name: "UFC - Campus do Pici", address: "Av. Humberto Monte, s/n - Pici, Fortaleza", category: "university", lat: -3.7453, lng: -38.5731, city: "Fortaleza" },

  // === PORTO ALEGRE ===
  { id: "pa-01", name: "Aeroporto Salgado Filho (POA)", address: "Av. Severo Dullius, 90010 - São João, Porto Alegre", category: "airport", lat: -29.9944, lng: -51.1713, city: "Porto Alegre" },
  { id: "pa-02", name: "Shopping Iguatemi POA", address: "Av. João Wallig, 1800 - Passo da Areia, Porto Alegre", category: "mall", lat: -30.0180, lng: -51.1592, city: "Porto Alegre" },
  { id: "pa-03", name: "UFRGS - Campus Centro", address: "Av. Paulo Gama, 110 - Farroupilha, Porto Alegre", category: "university", lat: -30.0346, lng: -51.2177, city: "Porto Alegre" },
  { id: "pa-04", name: "Rodoviária de Porto Alegre", address: "Largo Vespasiano Julio Veppo, 70 - Centro, Porto Alegre", category: "terminal", lat: -30.0278, lng: -51.2204, city: "Porto Alegre" },

  // === CIDADES MÉDIAS (foco do app) ===
  // Ribeirão Preto - SP
  { id: "rp-01", name: "Aeroporto de Ribeirão Preto (RAO)", address: "Av. Cap. José Lemes, s/n - Jardim Aeroporto, Ribeirão Preto", category: "airport", lat: -21.1364, lng: -47.7766, city: "Ribeirão Preto" },
  { id: "rp-02", name: "USP Ribeirão Preto", address: "Av. Bandeirantes, 3900 - Vila Monte Alegre, RP", category: "university", lat: -21.1627, lng: -47.8259, city: "Ribeirão Preto" },
  { id: "rp-03", name: "Shopping Santa Úrsula", address: "Av. Carlos Consoni, 800 - Jardim Canadá, RP", category: "mall", lat: -21.2161, lng: -47.8160, city: "Ribeirão Preto" },
  { id: "rp-04", name: "Rodoviária de Ribeirão Preto", address: "R. Eduardo Vergueiro de Lorena, s/n - Jardim Paulista, RP", category: "terminal", lat: -21.1764, lng: -47.8079, city: "Ribeirão Preto" },
  { id: "rp-05", name: "Savegnago Supermercado - Centro", address: "R. Álvares Cabral, 680 - Centro, Ribeirão Preto", category: "supermarket", lat: -21.1783, lng: -47.8113, city: "Ribeirão Preto" },

  // Campinas - SP
  { id: "cp-01", name: "Aeroporto de Viracopos (VCP)", address: "Rod. Santos Dumont, km 66 - Campinas", category: "airport", lat: -23.0074, lng: -47.1345, city: "Campinas" },
  { id: "cp-02", name: "Unicamp", address: "Cidade Universitária Zeferino Vaz - Barão Geraldo, Campinas", category: "university", lat: -22.8204, lng: -47.0664, city: "Campinas" },
  { id: "cp-03", name: "Shopping Iguatemi Campinas", address: "Av. Iguatemi, 777 - Vila Brandina, Campinas", category: "mall", lat: -22.8888, lng: -47.0512, city: "Campinas" },

  // Uberlândia - MG
  { id: "ub-01", name: "Aeroporto de Uberlândia (UDI)", address: "Av. Nicomedes Alves dos Santos, s/n - Uberlândia", category: "airport", lat: -18.8828, lng: -48.2253, city: "Uberlândia" },
  { id: "ub-02", name: "UFU - Campus Santa Mônica", address: "Av. João Naves de Ávila, 2121 - Santa Mônica, Uberlândia", category: "university", lat: -18.9188, lng: -48.2588, city: "Uberlândia" },
  { id: "ub-03", name: "Center Shopping Uberlândia", address: "Av. João Naves de Ávila, 1331 - Tibery, Uberlândia", category: "mall", lat: -18.9103, lng: -48.2544, city: "Uberlândia" },
  { id: "ub-04", name: "Supermercado Bretas - Centro", address: "Av. Afonso Pena, 780 - Centro, Uberlândia", category: "supermarket", lat: -18.9190, lng: -48.2767, city: "Uberlândia" },

  // Goiânia - GO
  { id: "go-01", name: "Aeroporto de Goiânia (GYN)", address: "Praça Cel. Moitinho de Almeida, s/n - Sta. Genoveva, Goiânia", category: "airport", lat: -16.6320, lng: -49.2207, city: "Goiânia" },
  { id: "go-02", name: "UFG - Campus Samambaia", address: "Av. Esperança, s/n - Chácaras de Recreio Samambaia, Goiânia", category: "university", lat: -16.6051, lng: -49.2654, city: "Goiânia" },
  { id: "go-03", name: "Shopping Flamboyant", address: "Av. Jamel Cecílio, 3300 - Jardim Goiás, Goiânia", category: "mall", lat: -16.7079, lng: -49.2364, city: "Goiânia" },
  { id: "go-04", name: "Rodoviária de Goiânia", address: "R. 44, s/n - Setor Norte Ferroviário, Goiânia", category: "terminal", lat: -16.6662, lng: -49.2644, city: "Goiânia" },

  // Manaus - AM
  { id: "mn-01", name: "Aeroporto Eduardo Gomes (MAO)", address: "Av. Santos Dumont, 1350 - Tarumã, Manaus", category: "airport", lat: -3.0386, lng: -60.0498, city: "Manaus" },
  { id: "mn-02", name: "Shopping Manauara", address: "Av. Mário Ypiranga, 1300 - Adrianópolis, Manaus", category: "mall", lat: -3.1068, lng: -60.0190, city: "Manaus" },
  { id: "mn-03", name: "UFAM - Campus Universitário", address: "Av. Gen. Rodrigo Octávio, 6200 - Coroado, Manaus", category: "university", lat: -3.0912, lng: -59.9643, city: "Manaus" },

  // Florianópolis - SC
  { id: "fl-01", name: "Aeroporto Hercílio Luz (FLN)", address: "Rod. Ac. ao Aeroporto, 6500 - Carianos, Florianópolis", category: "airport", lat: -27.6705, lng: -48.5471, city: "Florianópolis" },
  { id: "fl-02", name: "UFSC - Campus Trindade", address: "R. Eng. Agronômico Andrei C. Ferreira, s/n - Trindade, Florianópolis", category: "university", lat: -27.6004, lng: -48.5195, city: "Florianópolis" },
  { id: "fl-03", name: "Shopping Iguatemi Florianópolis", address: "Av. Madre Benvenuta, 687 - Santa Mônica, Florianópolis", category: "mall", lat: -27.5949, lng: -48.5145, city: "Florianópolis" },
  { id: "fl-04", name: "Praia da Joaquina", address: "R. Prefeito Acácio Garibaldi São Tiago - Joaquina, Florianópolis", category: "beach", lat: -27.6295, lng: -48.4471, city: "Florianópolis" },

  // Belém - PA
  { id: "be-01", name: "Aeroporto de Belém (BEL)", address: "Av. Júlio César, s/n - Val-de-Cans, Belém", category: "airport", lat: -1.3795, lng: -48.4764, city: "Belém" },
  { id: "be-02", name: "UFPA - Campus Guamá", address: "R. Augusto Corrêa, 01 - Guamá, Belém", category: "university", lat: -1.4744, lng: -48.4536, city: "Belém" },
  { id: "be-03", name: "Shopping Bosque Grão Pará", address: "Rod. Augusto Montenegro, km 8 - Coqueiro, Belém", category: "mall", lat: -1.3642, lng: -48.4481, city: "Belém" },
];

export const searchLocations = (query: string, limit = 8): CityLocation[] => {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return cityLocations
    .filter((loc) => {
      const text = `${loc.name} ${loc.address} ${loc.city} ${getCategoryLabel(loc.category)}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return text.includes(q);
    })
    .slice(0, limit);
};

export const getPopularLocations = (city?: string, limit = 6): CityLocation[] => {
  const priorityCategories: CityLocation["category"][] = ["airport", "mall", "terminal", "hospital", "university", "station"];
  let filtered = city
    ? cityLocations.filter((l) => l.city.toLowerCase().includes(city.toLowerCase()))
    : cityLocations;
  
  filtered.sort((a, b) => {
    const ai = priorityCategories.indexOf(a.category);
    const bi = priorityCategories.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  
  return filtered.slice(0, limit);
};
