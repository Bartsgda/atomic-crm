import { 
  useRecordContext,
  type RaRecord
} from "ra-core";
import { List } from "@/components/admin/list";
import { DataTable } from "@/components/admin/data-table";
import { Show } from "@/components/admin/show";
import { RecordField } from "@/components/admin/record-field";
import { TextField } from "@/components/admin/text-field";
import { DateField } from "@/components/admin/date-field";
import { MessageSquare, Eye, Info, AlertTriangle, Ban, Lightbulb, User } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SeverityBadge = () => {
  const record = useRecordContext();
  if (!record) return null;

  const config: Record<string, { label: string, color: string, icon: any }> = {
    info: { label: 'Informacja', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Info },
    idea: { label: 'Sugestia', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Lightbulb },
    bug: { label: 'Błąd', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: AlertTriangle },
    blocker: { label: 'Bloker', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: Ban },
  };

  const item = config[record.severity] || config.info;
  const Icon = item.icon;

  return (
    <Badge variant="outline" className={`${item.color} flex items-center gap-1 font-normal`}>
      <Icon className="h-3 w-3" />
      {item.label}
    </Badge>
  );
};

const ScreenshotField = () => {
  const record = useRecordContext();
  if (!record?.screenshot_b64) return <span className="text-muted-foreground italic text-xs">Brak zrzutu</span>;

  return (
    <div className="mt-4 border rounded-lg overflow-hidden bg-muted p-2">
      <p className="text-xs font-medium mb-2 flex items-center gap-2">
        <Eye className="h-3 w-3" />
        Przechwycony widok:
      </p>
      <img 
        src={record.screenshot_b64} 
        alt="Feedback Screenshot" 
        className="max-w-full h-auto cursor-zoom-in hover:scale-[1.02] transition-transform duration-300 rounded shadow-sm"
        onClick={() => {
          const win = window.open();
          if (win) {
            win.document.write(`<img src="${record.screenshot_b64}" style="max-width:100%" />`);
          }
        }}
      />
      {record.element_label && (
        <p className="mt-2 text-[10px] text-muted-foreground font-mono">
          Selector: {record.element_selector}
        </p>
      )}
    </div>
  );
};

export const FeedbackList = () => (
  <List 
    resource="insurance_feedback"
    title="Zgłoszenia i Feedback" 
    sort={{ field: 'created_at', order: 'DESC' }}
  >
    <DataTable rowClick="show">
      <DataTable.Col 
        label="Data" 
        render={(record: RaRecord) => <DateField record={record} source="created_at" showTime />} 
      />
      <DataTable.Col source="user_email" label="Użytkownik" />
      <DataTable.Col label="Typ" render={() => <SeverityBadge />} />
      <DataTable.Col source="message" label="Wiadomość" className="max-w-xs truncate" />
      <DataTable.Col source="route" label="Podstrona" className="text-xs text-muted-foreground" />
    </DataTable>
  </List>
);

export const FeedbackShow = () => (
  <Show resource="insurance_feedback" title="Szczegóły zgłoszenia">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
      <div className="md:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Treść zgłoszenia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg leading-relaxed whitespace-pre-wrap">
              <TextField source="message" />
            </p>
          </CardContent>
        </Card>
        
        <ScreenshotField />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              Metadane
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <RecordField source="id" label="ID zgłoszenia" variant="inline" />
            <RecordField source="created_at" label="Data" variant="inline">
              <DateField source="created_at" showTime />
            </RecordField>
            <RecordField label="Typ" variant="inline">
              <SeverityBadge />
            </RecordField>
            <RecordField source="user_email" label="Użytkownik" variant="inline">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <TextField source="user_email" />
              </div>
            </RecordField>
            <RecordField source="route" label="URL" variant="inline" className="text-xs" />
            <RecordField label="Rozdzielczość" variant="inline" render={(record) => `${record.viewport_w}x${record.viewport_h}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System / Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground font-mono leading-tight break-all">
              <TextField source="user_agent" />
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  </Show>
);
