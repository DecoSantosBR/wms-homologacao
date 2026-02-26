import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Camera, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

// Schema de validação
const ncgSchema = z.object({
  labelCode: z.string().min(1, 'Código da etiqueta é obrigatório'),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  description: z.string().min(10, 'Descrição deve ter no mínimo 10 caracteres'),
  photoUrl: z.string().optional(),
});

type NCGFormData = z.infer<typeof ncgSchema>;

interface RegisterNCGModalProps {
  isOpen: boolean;
  onClose: () => void;
  conferenceId: number;
  receivingOrderItemId: number | null;
  labelCode?: string;
  maxQuantity?: number; // Para limitar a quantidade bloqueada à quantidade recebida
}

export const RegisterNCGModal: React.FC<RegisterNCGModalProps> = ({
  isOpen,
  onClose,
  conferenceId,
  receivingOrderItemId,
  labelCode = '',
  maxQuantity = 1,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { register, handleSubmit, control, reset, setValue, formState: { errors, isSubmitting } } = useForm<NCGFormData>({
    resolver: zodResolver(ncgSchema),
    defaultValues: {
      labelCode: labelCode,
      quantity: 1, // Padrão Enterprise: 1 LPN = 1 Registro
      description: '',
      photoUrl: '',
    },
  });

  const utils = trpc.useUtils();

  // Mutation do tRPC
  const registerMutation = trpc.blindConference.registerNCG.useMutation({
    onSuccess: () => {
      toast.success('Não Conformidade registrada e item movido para NCG!');
      reset(); // Limpa o formulário
      setImagePreview(null);
      
      // Invalidar queries para atualizar lista
      utils.blindConference.getItems.invalidate();
      utils.blindConference.getSummary.invalidate();
      
      onClose(); // Fecha o modal
    },
    onError: (error) => {
      toast.error(`Erro ao registrar NCG: ${error.message}`);
    },
  });

  const onSubmit = (data: NCGFormData) => {
    if (data.quantity > maxQuantity) {
        toast.error(`A quantidade bloqueada (${data.quantity}) não pode exceder a quantidade recebida (${maxQuantity}).`);
        return;
    }

    if (!receivingOrderItemId) {
        toast.error("Erro interno: ID do item não fornecido.");
        return;
    }

    registerMutation.mutate({
      receivingOrderItemId: receivingOrderItemId,
      labelCode: data.labelCode,
      conferenceId: conferenceId,
      quantity: data.quantity,
      description: data.description,
      photoUrl: data.photoUrl,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máximo 5MB)');
      return;
    }

    setIsUploading(true);

    try {
      // Criar preview local
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // TODO: Implementar upload para S3
      // Por enquanto, usar preview local
      setValue('photoUrl', URL.createObjectURL(file));
      
      toast.success('Foto carregada com sucesso');
    } catch (error) {
      toast.error('Erro ao carregar foto');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const clearImage = () => {
    setValue('photoUrl', '');
    setImagePreview(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-destructive">
            <AlertCircle className="h-6 w-6" />
            Registrar Não Conformidade (NCG)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Label Code e Quantidade (Geralmente preenchidos ao bipar) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="labelCode">Etiqueta/LPN</Label>
              <Input
                id="labelCode"
                {...register('labelCode')}
                disabled
                className="bg-muted font-mono"
              />
              {errors.labelCode && <span className="text-xs text-red-500">{errors.labelCode.message}</span>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantidade</Label>
              <Controller
                control={control}
                name="quantity"
                render={({ field }) => (
                  <Input
                    id="quantity"
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    max={maxQuantity}
                    min={1}
                    className="font-bold text-center"
                  />
                )}
              />
              {errors.quantity && <span className="text-xs text-red-500">{errors.quantity.message}</span>}
            </div>
          </div>

          {/* Motivo da Não Conformidade (Textarea) */}
          <div className="space-y-1">
            <Label htmlFor="description">Descrição da Avaria/Motivo do Bloqueio</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Ex: Embalagem amassada, validade vencida, lote divergente..."
              className="h-24 resize-none"
            />
            {errors.description && <span className="text-xs text-red-500">{errors.description.message}</span>}
          </div>

          {/* Área de Foto (QA/Auditoria) */}
          <div className="space-y-2">
            <Label>Evidência Fotográfica (Opcional)</Label>
            {imagePreview ? (
              <div className="relative border rounded-lg p-2 bg-muted/50">
                <img src={imagePreview} alt="Avaria" className="max-h-40 w-auto mx-auto rounded-md" />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                <Camera className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Tirar foto ou anexar imagem</p>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="mt-3"
                  disabled={isUploading}
                />
                {isUploading && <p className="text-xs text-muted-foreground mt-2">Carregando...</p>}
              </div>
            )}
          </div>

          {/* Botão de Confirmação */}
          <Button 
            type="submit" 
            className="w-full h-12 text-lg gap-2" 
            variant="destructive" 
            disabled={isSubmitting || registerMutation.isPending}
          >
            {isSubmitting || registerMutation.isPending ? (
              <span>Registrando...</span>
            ) : (
              <>
                <AlertCircle />
                Confirmar Bloqueio e Enviar para NCG
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
