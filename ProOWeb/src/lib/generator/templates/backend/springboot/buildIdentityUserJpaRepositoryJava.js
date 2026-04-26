function buildIdentityUserJpaRepositoryJava() {
  return `package com.prooweb.generated.identity.infrastructure.persistence;

import com.prooweb.generated.identity.infrastructure.persistence.entity.UserAccountEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdentityUserJpaRepository extends JpaRepository<UserAccountEntity, Long> {
  Optional<UserAccountEntity> findByUsernameIgnoreCase(String username);

  Optional<UserAccountEntity> findByEmailIgnoreCase(String email);
}
`;
}

module.exports = {
  buildIdentityUserJpaRepositoryJava,
};
