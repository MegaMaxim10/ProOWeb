function buildLiquibaseBaselineSchemaChangelogYaml() {
  return `databaseChangeLog:
  - changeSet:
      id: 001-create-identity-roles
      author: prooweb
      context: baseline
      changes:
        - createTable:
            tableName: identity_roles
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    nullable: false
                    primaryKey: true
                    primaryKeyName: pk_identity_roles
              - column:
                  name: code
                  type: VARCHAR(96)
                  constraints:
                    nullable: false
              - column:
                  name: description
                  type: VARCHAR(255)
                  constraints:
                    nullable: false
              - column:
                  name: active
                  type: BOOLEAN
                  constraints:
                    nullable: false
        - addUniqueConstraint:
            tableName: identity_roles
            columnNames: code
            constraintName: uk_identity_roles_code

  - changeSet:
      id: 002-create-identity-users
      author: prooweb
      context: baseline
      changes:
        - createTable:
            tableName: identity_users
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    nullable: false
                    primaryKey: true
                    primaryKeyName: pk_identity_users
              - column:
                  name: display_name
                  type: VARCHAR(160)
                  constraints:
                    nullable: false
              - column:
                  name: email
                  type: VARCHAR(190)
                  constraints:
                    nullable: false
              - column:
                  name: username
                  type: VARCHAR(120)
                  constraints:
                    nullable: false
              - column:
                  name: password_digest
                  type: VARCHAR(255)
                  constraints:
                    nullable: false
              - column:
                  name: activation_token
                  type: VARCHAR(64)
              - column:
                  name: password_reset_token
                  type: VARCHAR(64)
              - column:
                  name: mfa_mode
                  type: VARCHAR(16)
                  constraints:
                    nullable: false
              - column:
                  name: mfa_totp_secret
                  type: VARCHAR(128)
              - column:
                  name: mfa_otp_code
                  type: VARCHAR(16)
              - column:
                  name: active
                  type: BOOLEAN
                  constraints:
                    nullable: false
        - addUniqueConstraint:
            tableName: identity_users
            columnNames: email
            constraintName: uk_identity_users_email
        - addUniqueConstraint:
            tableName: identity_users
            columnNames: username
            constraintName: uk_identity_users_username
        - addUniqueConstraint:
            tableName: identity_users
            columnNames: activation_token
            constraintName: uk_identity_users_activation_token
        - addUniqueConstraint:
            tableName: identity_users
            columnNames: password_reset_token
            constraintName: uk_identity_users_password_reset_token

  - changeSet:
      id: 003-create-identity-role-permissions
      author: prooweb
      context: baseline
      changes:
        - createTable:
            tableName: identity_role_permissions
            columns:
              - column:
                  name: role_id
                  type: BIGINT
                  constraints:
                    nullable: false
              - column:
                  name: permission_code
                  type: VARCHAR(96)
                  constraints:
                    nullable: false
        - addPrimaryKey:
            tableName: identity_role_permissions
            columnNames: role_id, permission_code
            constraintName: pk_identity_role_permissions
        - addForeignKeyConstraint:
            baseTableName: identity_role_permissions
            baseColumnNames: role_id
            referencedTableName: identity_roles
            referencedColumnNames: id
            onDelete: CASCADE
            constraintName: fk_identity_role_permissions_role

  - changeSet:
      id: 004-create-identity-user-roles
      author: prooweb
      context: baseline
      changes:
        - createTable:
            tableName: identity_user_roles
            columns:
              - column:
                  name: user_id
                  type: BIGINT
                  constraints:
                    nullable: false
              - column:
                  name: role_id
                  type: BIGINT
                  constraints:
                    nullable: false
        - addPrimaryKey:
            tableName: identity_user_roles
            columnNames: user_id, role_id
            constraintName: pk_identity_user_roles
        - addForeignKeyConstraint:
            baseTableName: identity_user_roles
            baseColumnNames: user_id
            referencedTableName: identity_users
            referencedColumnNames: id
            onDelete: CASCADE
            constraintName: fk_identity_user_roles_user
        - addForeignKeyConstraint:
            baseTableName: identity_user_roles
            baseColumnNames: role_id
            referencedTableName: identity_roles
            referencedColumnNames: id
            onDelete: CASCADE
            constraintName: fk_identity_user_roles_role
`;
}

module.exports = {
  buildLiquibaseBaselineSchemaChangelogYaml,
};

