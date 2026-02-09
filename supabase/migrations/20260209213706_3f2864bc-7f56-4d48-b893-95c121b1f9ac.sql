
-- Function to seed default OPEX services when a new organization is created
CREATE OR REPLACE FUNCTION public.seed_default_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.products (code, name, type, unit, unit_price, category, description, user_id, organization_id, active)
  VALUES
    ('SERV004','Energia Elétrica','servico','mês',0,'Utilidades','Fornecimento de energia elétrica', NEW.created_by, NEW.id, true),
    ('SERV005','Água e Esgoto','servico','mês',0,'Utilidades','Fornecimento de água e tratamento de esgoto', NEW.created_by, NEW.id, true),
    ('SERV006','Internet / Banda Larga','servico','mês',0,'Telecomunicações','Serviço de acesso à internet', NEW.created_by, NEW.id, true),
    ('SERV007','Telefonia Fixa','servico','mês',0,'Telecomunicações','Serviço de telefonia fixa', NEW.created_by, NEW.id, true),
    ('SERV008','Telefonia Móvel','servico','mês',0,'Telecomunicações','Planos de telefonia móvel corporativa', NEW.created_by, NEW.id, true),
    ('SERV009','Aluguel de Imóvel','servico','mês',0,'Ocupação','Locação de imóvel comercial', NEW.created_by, NEW.id, true),
    ('SERV010','Condomínio','servico','mês',0,'Ocupação','Taxa condominial do imóvel', NEW.created_by, NEW.id, true),
    ('SERV011','Seguro Empresarial','servico','mês',0,'Seguros','Seguro patrimonial e responsabilidade civil', NEW.created_by, NEW.id, true),
    ('SERV012','Contabilidade','servico','mês',0,'Serviços Profissionais','Serviços contábeis e fiscais', NEW.created_by, NEW.id, true),
    ('SERV013','Assessoria Jurídica','servico','mês',0,'Serviços Profissionais','Consultoria e assessoria jurídica', NEW.created_by, NEW.id, true),
    ('SERV014','Limpeza e Conservação','servico','mês',0,'Facilities','Serviço de limpeza e manutenção predial', NEW.created_by, NEW.id, true),
    ('SERV015','Vigilância / Segurança','servico','mês',0,'Facilities','Serviço de vigilância e segurança patrimonial', NEW.created_by, NEW.id, true),
    ('SERV016','Software / SaaS','servico','mês',0,'Tecnologia','Licenças de software e assinaturas SaaS', NEW.created_by, NEW.id, true),
    ('SERV017','Hospedagem / Cloud','servico','mês',0,'Tecnologia','Serviços de hospedagem e infraestrutura em nuvem', NEW.created_by, NEW.id, true),
    ('SERV018','Suporte de TI','servico','mês',0,'Tecnologia','Serviço de suporte e manutenção de TI', NEW.created_by, NEW.id, true),
    ('SERV019','Correios / Logística','servico','mês',0,'Logística','Serviços postais e de entrega', NEW.created_by, NEW.id, true),
    ('SERV020','Material de Escritório','servico','mês',0,'Suprimentos','Fornecimento de material de expediente', NEW.created_by, NEW.id, true),
    ('SERV021','Gás','servico','mês',0,'Utilidades','Fornecimento de gás canalizado ou GLP', NEW.created_by, NEW.id, true),
    ('SERV022','Plano de Saúde','servico','mês',0,'Benefícios','Plano de saúde empresarial', NEW.created_by, NEW.id, true),
    ('SERV023','Vale Transporte','servico','mês',0,'Benefícios','Benefício de transporte para colaboradores', NEW.created_by, NEW.id, true),
    ('SERV024','Vale Refeição / Alimentação','servico','mês',0,'Benefícios','Benefício alimentação para colaboradores', NEW.created_by, NEW.id, true),
    ('SERV025','Publicidade e Marketing','servico','mês',0,'Marketing','Serviços de publicidade, mídia e marketing digital', NEW.created_by, NEW.id, true);

  RETURN NEW;
END;
$$;

-- Trigger: seed services after new org is created
CREATE TRIGGER seed_services_on_org_create
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_services();
