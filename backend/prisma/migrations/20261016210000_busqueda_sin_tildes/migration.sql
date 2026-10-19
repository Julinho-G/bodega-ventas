-- Extensión de PostgreSQL que quita las tildes: unaccent('Azúcar') = 'Azucar'.
-- Permite que la búsqueda "azucar" encuentre "Azúcar rubia".
CREATE EXTENSION IF NOT EXISTS unaccent;
