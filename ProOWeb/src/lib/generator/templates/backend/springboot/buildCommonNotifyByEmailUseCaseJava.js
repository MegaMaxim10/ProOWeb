function buildCommonNotifyByEmailUseCaseJava() {
  return `package com.prooweb.generated.common.application.notification.port.in;

import com.prooweb.generated.common.domain.notification.model.EmailNotification;

public interface NotifyByEmailUseCase {
  void notify(EmailNotification notification);
}
`;
}

module.exports = {
  buildCommonNotifyByEmailUseCaseJava,
};
