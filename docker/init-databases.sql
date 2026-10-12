-- Initialize isolated databases for each microservice
CREATE DATABASE autosupply_auth;
CREATE DATABASE autosupply_supplier;
CREATE DATABASE autosupply_component;
CREATE DATABASE autosupply_order;

GRANT ALL PRIVILEGES ON DATABASE autosupply_auth TO autosupply;
GRANT ALL PRIVILEGES ON DATABASE autosupply_supplier TO autosupply;
GRANT ALL PRIVILEGES ON DATABASE autosupply_component TO autosupply;
GRANT ALL PRIVILEGES ON DATABASE autosupply_order TO autosupply;
