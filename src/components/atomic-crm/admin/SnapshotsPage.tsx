import { 
  useListContext,
  useNotify,
  useRefresh,
  type RaRecord
} from "ra-core";
import { List } from "@/components/admin/list";
import { DataTable } from "@/components/admin/data-table";
import { 
  History, 
  RotateCcw, 
  Trash2, 
  Database,
  CheckCircle2,
  AlertCircle,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { snapshotService } from "../providers/supabase/snapshotService";

export const SnapshotsPage = () => (
  <List 
    resource="insurance_snapshots"
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={10}
    title="Punkty Kontrolne Systemu (Snapshots)"
  >
    <SnapshotsList />
  </List>
);

const SnapshotsList = () => {
  const { isPending } = useListContext();

  if (isPending) return null;

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-primary">
            <History className="h-5 w-5" />
            <CardTitle className="text-lg">Zarządzanie Stanem Systemu</CardTitle>
          </div>
          <CardDescription>
            Tutaj możesz przywrócić stan systemu z wybranego punktu w czasie. 
            Każdy snapshot zawiera kompletne dane Twojego biura (klienci, polisy, szkody).
          </CardDescription>
        </CardHeader>
      </Card>

      <DataTable>
        <DataTable.Col 
          label="Data utworzenia" 
          render={(record: RaRecord) => (
            <div className="flex flex-col">
              <span className="font-medium">
                {format(new Date(record.created_at), "d MMMM yyyy", { locale: pl })}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(record.created_at), "HH:mm:ss")}
              </span>
            </div>
          )}
        />
        <DataTable.Col 
          label="Opis / Notatka" 
          render={(record: RaRecord) => (
            <div className="flex items-center gap-2">
              <Badge variant={record.note?.includes('Automatyczny') ? "secondary" : "outline"}>
                {record.note?.includes('Automatyczny') ? 'Automatyczny' : 'Manualny'}
              </Badge>
              {record.note && (
                <span className="text-sm text-muted-foreground truncate max-w-[300px]" title={record.note}>
                  {record.note}
                </span>
              )}
            </div>
          )}
        />
        <DataTable.Col 
          label="Status" 
          render={() => (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Gotowy
            </Badge>
          )}
        />
        <DataTable.Col 
          label="Zawartość" 
          render={(record: RaRecord) => {
            // Stats is an object where keys are table names
            const tableCount = record.stats ? Object.keys(record.stats).length : 0;
            const totalRows = record.stats ? Object.values(record.stats as object).reduce((a: number, b: number) => a + b, 0) : 0;
            
            return (
              <div className="flex flex-col text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <Database className="h-3 w-3 text-muted-foreground" />
                  {tableCount} tabele
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {totalRows} rekordów
                </div>
              </div>
            );
          }}
        />
        <DataTable.Col 
          label="Akcje" 
          headerClassName="text-right"
          cellClassName="text-right"
          render={(record: RaRecord) => (
            <div className="flex justify-end gap-2">
              <RestoreButton snapshot={record} />
              <DeleteButton snapshot={record} />
            </div>
          )}
        />
      </DataTable>
    </div>
  );
};

const RestoreButton = ({ snapshot }: { snapshot: RaRecord }) => {
  const notify = useNotify();
  const refresh = useRefresh();

  const handleRestore = async () => {
    try {
      notify('Rozpoczynanie przywracania danych...', { type: 'info' });
      await snapshotService.restoreSnapshot(String(snapshot.id));
      notify('System został pomyślnie przywrócony!', { type: 'success' });
      refresh();
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Restore failed:', error);
      notify('Błąd podczas przywracania: ' + (error instanceof Error ? error.message : 'Nieznany błąd'), { type: 'error' });
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
          <RotateCcw className="h-4 w-4" />
          Przywróć
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Czy na pewno chcesz przywrócić system?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ta operacja nadpisze WSZYSTKIE obecne dane klientów, polis i szkód danymi z dnia 
            <span className="font-bold text-foreground mx-1">
              {format(new Date(snapshot.created_at), "d MMMM yyyy (HH:mm)", { locale: pl })}
            </span>.
            Obecny stan bazy zostanie utracony (chyba że masz inny snapshot).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={handleRestore} className="bg-primary hover:bg-primary/90">
            Tak, przywróć ten stan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const DeleteButton = ({ snapshot }: { snapshot: RaRecord }) => {
  const notify = useNotify();
  const refresh = useRefresh();

  const handleDelete = async () => {
    try {
      await snapshotService.deleteSnapshot(String(snapshot.id));
      notify('Punkt kontrolny został usunięty.', { type: 'success' });
      refresh();
    } catch (error) {
      notify('Błąd usuwania: ' + (error instanceof Error ? error.message : 'Nieznany błąd'), { type: 'error' });
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleDelete} 
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
};
