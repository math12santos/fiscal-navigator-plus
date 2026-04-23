import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Edit2, Power, Truck, UserCircle, Package, Wrench, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import EntityFormDialog from "@/components/EntityFormDialog";
import ProductFormDialog from "@/components/ProductFormDialog";
import CadastroImportDialog, { type CadastroKind } from "@/components/cadastros/CadastroImportDialog";
import { useEntities, Entity } from "@/hooks/useEntities";
import { useProducts, Product } from "@/hooks/useProducts";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const ALL_TABS = [
  { key: "fornecedores", label: "Fornecedores" },
  { key: "clientes", label: "Clientes" },
  { key: "produtos", label: "Produtos" },
  { key: "servicos", label: "Serviços" },
];

export default function Cadastros() {
  const { getAllowedTabs } = useUserPermissions();
  const allowedTabs = getAllowedTabs("cadastro", ALL_TABS);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") && allowedTabs.find((t) => t.key === searchParams.get("tab"))
    ? searchParams.get("tab")!
    : (allowedTabs[0]?.key ?? "fornecedores");

  const { entities, isLoading: loadingEntities, create: createEntity, update: updateEntity, toggleActive: toggleEntityActive } = useEntities();
  const { products, isLoading: loadingProducts, create: createProduct, update: updateProduct, toggleActive: toggleProductActive } = useProducts();
  const { accounts } = useChartOfAccounts();

  // Fornecedores
  const [fornecSearch, setFornecSearch] = useState("");
  const [fornecDialogOpen, setFornecDialogOpen] = useState(false);
  const [editingFornec, setEditingFornec] = useState<Entity | null>(null);

  // Clientes
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Entity | null>(null);

  // Produtos
  const [produtoSearch, setProdutoSearch] = useState("");
  const [produtoCatFilter, setProdutoCatFilter] = useState("__all__");
  const [produtoDialogOpen, setProdutoDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Product | null>(null);

  // Serviços
  const [servicoSearch, setServicoSearch] = useState("");
  const [servicoCatFilter, setServicoCatFilter] = useState("__all__");
  const [servicoDialogOpen, setServicoDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Product | null>(null);

  // Importação
  const [importKind, setImportKind] = useState<CadastroKind | null>(null);

  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const fornecedores = useMemo(
    () => entities.filter((e) => e.type === "fornecedor" || e.type === "ambos"),
    [entities]
  );
  const clientes = useMemo(
    () => entities.filter((e) => e.type === "cliente" || e.type === "ambos"),
    [entities]
  );
  const produtos = useMemo(() => products.filter((p) => p.type === "produto"), [products]);
  const servicos = useMemo(() => products.filter((p) => p.type === "servico"), [products]);

  const filteredFornec = fornecedores.filter((e) => {
    const q = fornecSearch.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || (e.document_number || "").includes(fornecSearch);
  });
  const filteredCliente = clientes.filter((e) => {
    const q = clienteSearch.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || (e.document_number || "").includes(clienteSearch);
  });

  const produtoCategories = useMemo(
    () => [...new Set(produtos.map((p) => p.category).filter(Boolean))] as string[],
    [produtos]
  );
  const servicoCategories = useMemo(
    () => [...new Set(servicos.map((p) => p.category).filter(Boolean))] as string[],
    [servicos]
  );

  const filteredProdutos = produtos.filter((p) => {
    const q = produtoSearch.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchCat = produtoCatFilter === "__all__" || p.category === produtoCatFilter;
    return matchSearch && matchCat;
  });
  const filteredServicos = servicos.filter((p) => {
    const q = servicoSearch.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchCat = servicoCatFilter === "__all__" || p.category === servicoCatFilter;
    return matchSearch && matchCat;
  });

  const onTabChange = (v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", v);
      return next;
    });
  };

  const KpiCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Cadastros"
        description="Fornecedores, Clientes, Produtos e Serviços"
        showHoldingToggle={false}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={Truck} label="fornecedores ativos" value={fornecedores.filter((e) => e.active).length} />
        <KpiCard icon={UserCircle} label="clientes ativos" value={clientes.filter((e) => e.active).length} />
        <KpiCard icon={Package} label="produtos ativos" value={produtos.filter((p) => p.active).length} />
        <KpiCard icon={Wrench} label="serviços ativos" value={servicos.filter((p) => p.active).length} />
      </div>

      <Tabs value={initialTab} onValueChange={onTabChange} className="space-y-4">
        <TabsList>
          {allowedTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ===== FORNECEDORES ===== */}
        <TabsContent value="fornecedores" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome ou documento..."
                value={fornecSearch}
                onChange={(e) => setFornecSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => setImportKind("fornecedor")}>
              <Upload size={16} /> Importar
            </Button>
            <Button onClick={() => { setEditingFornec(null); setFornecDialogOpen(true); }}>
              <Plus size={16} /> Novo Fornecedor
            </Button>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingEntities ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredFornec.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum fornecedor cadastrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFornec.map((e) => (
                    <TableRow key={e.id} className={!e.active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{e.type}</Badge></TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{e.document_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.phone ?? "—"}</TableCell>
                      <TableCell><Badge variant={e.active ? "default" : "secondary"}>{e.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingFornec(e); setFornecDialogOpen(true); }}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleEntityActive.mutate({ id: e.id, active: !e.active })}>
                            <Power size={13} className={e.active ? "text-success" : "text-destructive"} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <EntityFormDialog
            open={fornecDialogOpen}
            onOpenChange={setFornecDialogOpen}
            entity={editingFornec}
            defaultType="fornecedor"
            onSubmit={(data) => {
              if (editingFornec) {
                updateEntity.mutate(data, { onSuccess: () => setFornecDialogOpen(false) });
              } else {
                createEntity.mutate(data, { onSuccess: () => setFornecDialogOpen(false) });
              }
            }}
            isLoading={createEntity.isPending || updateEntity.isPending}
          />
        </TabsContent>

        {/* ===== CLIENTES ===== */}
        <TabsContent value="clientes" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome ou documento..."
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => setImportKind("cliente")}>
              <Upload size={16} /> Importar
            </Button>
            <Button onClick={() => { setEditingCliente(null); setClienteDialogOpen(true); }}>
              <Plus size={16} /> Novo Cliente
            </Button>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingEntities ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredCliente.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum cliente cadastrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCliente.map((e) => (
                    <TableRow key={e.id} className={!e.active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{e.type}</Badge></TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{e.document_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.phone ?? "—"}</TableCell>
                      <TableCell><Badge variant={e.active ? "default" : "secondary"}>{e.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCliente(e); setClienteDialogOpen(true); }}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleEntityActive.mutate({ id: e.id, active: !e.active })}>
                            <Power size={13} className={e.active ? "text-success" : "text-destructive"} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <EntityFormDialog
            open={clienteDialogOpen}
            onOpenChange={setClienteDialogOpen}
            entity={editingCliente}
            defaultType="cliente"
            onSubmit={(data) => {
              if (editingCliente) {
                updateEntity.mutate(data, { onSuccess: () => setClienteDialogOpen(false) });
              } else {
                createEntity.mutate(data, { onSuccess: () => setClienteDialogOpen(false) });
              }
            }}
            isLoading={createEntity.isPending || updateEntity.isPending}
          />
        </TabsContent>

        {/* ===== PRODUTOS ===== */}
        <TabsContent value="produtos" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome ou código..."
                value={produtoSearch}
                onChange={(e) => setProdutoSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={produtoCatFilter} onValueChange={setProdutoCatFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {produtoCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setImportKind("produto")}>
              <Upload size={16} /> Importar
            </Button>
            <Button onClick={() => { setEditingProduto(null); setProdutoDialogOpen(true); }}>
              <Plus size={16} /> Novo Produto
            </Button>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingProducts ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredProdutos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum produto cadastrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Valor Unit.</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProdutos.map((p) => (
                    <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                      <TableCell>{fmt.format(p.unit_price)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                      <TableCell><Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingProduto(p); setProdutoDialogOpen(true); }}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleProductActive.mutate({ id: p.id, active: !p.active })}>
                            <Power size={13} className={p.active ? "text-success" : "text-destructive"} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <ProductFormDialog
            open={produtoDialogOpen}
            onOpenChange={setProdutoDialogOpen}
            product={editingProduto}
            products={products}
            accounts={accounts}
            defaultType="produto"
            onSubmit={(data) => {
              if (editingProduto) {
                updateProduct.mutate(data, { onSuccess: () => setProdutoDialogOpen(false) });
              } else {
                createProduct.mutate(data, { onSuccess: () => setProdutoDialogOpen(false) });
              }
            }}
            isLoading={createProduct.isPending || updateProduct.isPending}
          />
        </TabsContent>

        {/* ===== SERVIÇOS ===== */}
        <TabsContent value="servicos" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar por nome ou código..."
                value={servicoSearch}
                onChange={(e) => setServicoSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={servicoCatFilter} onValueChange={setServicoCatFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {servicoCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setImportKind("servico")}>
              <Upload size={16} /> Importar
            </Button>
            <Button onClick={() => { setEditingServico(null); setServicoDialogOpen(true); }}>
              <Plus size={16} /> Novo Serviço
            </Button>
          </div>
          <div className="glass-card overflow-hidden">
            {loadingProducts ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredServicos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum serviço cadastrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Valor Unit.</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServicos.map((p) => (
                    <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                      <TableCell>{fmt.format(p.unit_price)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                      <TableCell><Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingServico(p); setServicoDialogOpen(true); }}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleProductActive.mutate({ id: p.id, active: !p.active })}>
                            <Power size={13} className={p.active ? "text-success" : "text-destructive"} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <ProductFormDialog
            open={servicoDialogOpen}
            onOpenChange={setServicoDialogOpen}
            product={editingServico}
            products={products}
            accounts={accounts}
            defaultType="servico"
            onSubmit={(data) => {
              if (editingServico) {
                updateProduct.mutate(data, { onSuccess: () => setServicoDialogOpen(false) });
              } else {
                createProduct.mutate(data, { onSuccess: () => setServicoDialogOpen(false) });
              }
            }}
            isLoading={createProduct.isPending || updateProduct.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
