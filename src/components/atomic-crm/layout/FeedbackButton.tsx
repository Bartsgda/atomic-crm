import { useState } from 'react';
import { Bug, Send, X, Camera, Info, AlertTriangle, Lightbulb, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pickElement, submitFeedback, CapturedElement } from '../services/feedbackCapture';

export const FeedbackButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'info' | 'bug' | 'idea' | 'blocker'>('bug');
  const [captured, setCaptured] = useState<CapturedElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartCapture = async () => {
    setIsOpen(false);
    setIsPicking(true);
    toast.info('Wskaż myszką element na ekranie, którego dotyczy zgłoszenie i kliknij go.', {
      duration: 5000,
      description: 'Naciśnij Escape, aby anulować.'
    });

    try {
      const result = await pickElement();
      if (result) {
        setCaptured(result);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Błąd przechwytywania:', error);
      toast.error('Nie udało się przechwycić elementu.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Wpisz treść wiadomości.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({
        message,
        severity,
        captured
      });
      toast.success('Dziękujemy! Zgłoszenie zostało wysłane do administratora.', {
        description: 'Twoja opinia pomaga nam ulepszać system.'
      });
      setIsOpen(false);
      setMessage('');
      setCaptured(null);
    } catch (error: any) {
      toast.error('Błąd wysyłania', {
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPicking) return null;

  return (
    <>
      <div 
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2"
        data-feedback-ui="true"
      >
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg border border-primary/20 bg-background/80 backdrop-blur hover:bg-primary hover:text-primary-foreground transition-all duration-300 group h-12 w-12"
          onClick={() => setIsOpen(true)}
          title="Zgłoś błąd lub sugestię"
        >
          <Bug className="h-6 w-6 group-hover:animate-pulse" />
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]" data-feedback-ui="true">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-primary" />
              Zgłoś błąd / Sugestię
            </DialogTitle>
            <DialogDescription>
              Pomóż nam ulepszyć system. Twoje zgłoszenie trafi bezpośrednio do Bartka.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Priorytet / Typ</label>
              <Select value={severity} onValueChange={(val: any) => setSeverity(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      Informacja / Pytanie
                    </div>
                  </SelectItem>
                  <SelectItem value="idea">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Sugestia / Pomysł
                    </div>
                  </SelectItem>
                  <SelectItem value="bug">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Błąd (Bug)
                    </div>
                  </SelectItem>
                  <SelectItem value="blocker">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-red-500" />
                      Krytyczny (Blokuje pracę)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Opis problemu</label>
              <Textarea 
                placeholder="Co się stało? Jakiego wyniku oczekiwałeś/aś?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Zrzut ekranu (opcjonalnie)</label>
              {captured ? (
                <div className="relative group rounded-md overflow-hidden border border-border bg-muted aspect-video flex items-center justify-center">
                  {captured.screenshotB64 ? (
                    <img 
                      src={captured.screenshotB64} 
                      alt="Screenshot" 
                      className="object-contain max-h-full"
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground">Nie udało się wygenerować obrazu</div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" onClick={handleStartCapture}>
                      <Camera className="h-4 w-4 mr-2" />
                      Zmień
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setCaptured(null)}>
                      <X className="h-4 w-4 mr-2" />
                      Usuń
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full border-dashed" 
                  onClick={handleStartCapture}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Zaznacz element na ekranie
                </Button>
              )}
              {captured && (
                <p className="text-[10px] text-muted-foreground truncate italic">
                  Element: {captured.label}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Anuluj</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !message.trim()}
            >
              {isSubmitting ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
