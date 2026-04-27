function buildLiquibaseReferenceDataChangelogYaml() {
  return `databaseChangeLog:
  - changeSet:
      id: 010-seed-platform-super-admin-role
      author: prooweb
      context: reference-data
      preConditions:
        onFail: MARK_RAN
        sqlCheck:
          expectedResult: "0"
          sql: "SELECT COUNT(*) FROM identity_roles WHERE code = 'PLATFORM_SUPER_ADMIN'"
      changes:
        - insert:
            tableName: identity_roles
            columns:
              - column:
                  name: code
                  value: PLATFORM_SUPER_ADMIN
              - column:
                  name: description
                  value: Platform super administrator
              - column:
                  name: active
                  valueBoolean: true

  - changeSet:
      id: 011-seed-platform-super-admin-role-permissions
      author: prooweb
      context: reference-data
      preConditions:
        onFail: MARK_RAN
        sqlCheck:
          expectedResult: "0"
          sql: "SELECT COUNT(*) FROM identity_role_permissions WHERE permission_code = 'IDENTITY_SUPER_ADMIN'"
      changes:
        - sql:
            sql: |
              INSERT INTO identity_role_permissions (role_id, permission_code)
              SELECT r.id, p.permission_code
              FROM identity_roles r
              CROSS JOIN (
                SELECT 'IDENTITY_SUPER_ADMIN' AS permission_code
                UNION ALL SELECT 'IDENTITY_USER_READ'
                UNION ALL SELECT 'IDENTITY_USER_CREATE'
                UNION ALL SELECT 'IDENTITY_ROLE_READ'
                UNION ALL SELECT 'IDENTITY_ROLE_CREATE'
                UNION ALL SELECT 'IDENTITY_ROLE_ASSIGN'
              ) p
              WHERE r.code = 'PLATFORM_SUPER_ADMIN';
`;
}

module.exports = {
  buildLiquibaseReferenceDataChangelogYaml,
};

