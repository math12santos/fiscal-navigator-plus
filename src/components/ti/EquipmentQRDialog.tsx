import { useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  equipment: { patrimonial_code: string; name: string } | null;
}

export function EquipmentQRDialog({ open, onOpenChange, equipment }: Props) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!open || !equipment) return;
    QRCode.toDataURL(equipment.patrimonial_code, { width: 320, margin: 1 }).then(setDataUrl);
  }, [open, equipment]);

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w || !equipment) return;
    w.document.write(`
      <html><head><title>${equipment.patrimonial_code}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:32px}img{width:300px;height:300px}h2{margin:8px 0}p{margin:4px 0;color:#555}</style>
      </head><body>
      <img src="${dataUrl}" />
      <h2>${equipment.patrimonial_code}</h2>
      <p>${equipment.name}</p>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
      </body></html>
    `);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Etiqueta QR — {equipment?.patrimonial_code}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-2 py-4">
          {dataUrl && <img src={dataUrl} alt="QR" className="w-64 h-64" />}
          <p className="font-mono font-semibold">{equipment?.patrimonial_code}</p>
          <p className="text-sm text-muted-foreground">{equipment?.name}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" asChild><a href={dataUrl} download={`${equipment?.patrimonial_code}.png`}><Download className="h-4 w-4 mr-2" />Baixar</a></Button>
          <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
