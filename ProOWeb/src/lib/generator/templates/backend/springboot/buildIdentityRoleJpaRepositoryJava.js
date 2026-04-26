function buildIdentityRoleJpaRepositoryJava() {
  return `package com.prooweb.generated.identity.infrastructure.persistence;

import com.prooweb.generated.identity.infrastructure.persistence.entity.RoleEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdentityRoleJpaRepository extends JpaRepository<RoleEntity, Long> {
  Optional<RoleEntity> findByCodeIgnoreCase(String code);
}
`;
}

module.exports = {
  buildIdentityRoleJpaRepositoryJava,
};
