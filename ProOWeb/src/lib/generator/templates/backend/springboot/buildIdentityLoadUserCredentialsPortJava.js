function buildIdentityLoadUserCredentialsPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.UserCredentials;
import java.util.Optional;

public interface LoadUserCredentialsPort {
  Optional<UserCredentials> loadByUsername(String username);
}
`;
}

module.exports = {
  buildIdentityLoadUserCredentialsPortJava,
};
