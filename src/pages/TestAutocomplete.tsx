/**
 * Tela de teste isolada do autocomplete de endereços (Embarque + Destino).
 * Rota: /test-autocomplete
 *
 * Esta tela existe apenas para validar a funcionalidade de busca/seleção de endereços
 * via Google Places. Não envolve mapa, login, pagamento, corrida ou backend de regras.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AddressAutocompleteField from "@/components/address/AddressAutocompleteField";
import type { PlaceDetails } from "@/services/googlePlaces";

export default function TestAutocomplete() {
  const [pickup, setPickup] = useState<PlaceDetails | null>(null);
  const [destination, setDestination] = useState<PlaceDetails | null>(null);
  const [errors, setErrors] = useState<{ pickup?: string; destination?: string }>({});
  const [submitted, setSubmitted] = useState<{
    pickup: PlaceDetails;
    destination: PlaceDetails;
  } | null>(null);

  const handleConfirm = () => {
    const next: typeof errors = {};
    if (!pickup) next.pickup = "Selecione um endereço de embarque na lista de sugestões.";
    if (!destination) next.destination = "Selecione um endereço de destino na lista de sugestões.";
    setErrors(next);
    if (next.pickup || next.destination) {
      toast.error("Escolha endereços válidos das sugestões.");
      return;
    }
    setSubmitted({ pickup: pickup!, destination: destination! });
    toast.success("Endereços capturados com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Para onde vamos?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Teste isolado de autocomplete de endereços
          </p>
        </header>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
          <AddressAutocompleteField
            label="Embarque"
            placeholder="Digite o local de embarque"
            value={pickup}
            onChange={(v) => {
              setPickup(v);
              if (v) setErrors((e) => ({ ...e, pickup: undefined }));
            }}
            accentClassName="text-emerald-500"
            error={errors.pickup}
            autoFocus
          />

          <AddressAutocompleteField
            label="Destino"
            placeholder="Para onde você vai?"
            value={destination}
            onChange={(v) => {
              setDestination(v);
              if (v) setErrors((e) => ({ ...e, destination: undefined }));
            }}
            accentClassName="text-rose-500"
            error={errors.destination}
          />

          <Button onClick={handleConfirm} className="w-full" size="lg">
            Confirmar endereços
          </Button>
        </div>

        {submitted && (
          <section className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Dados capturados (debug)
            </h2>
            <DataCard title="Embarque" data={submitted.pickup} accent="bg-emerald-500" />
            <DataCard title="Destino" data={submitted.destination} accent="bg-rose-500" />
          </section>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Resultados restritos ao Brasil • session token ativo
        </p>
      </div>
    </div>
  );
}

function DataCard({
  title,
  data,
  accent,
}: {
  title: string;
  data: PlaceDetails;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-xs leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
